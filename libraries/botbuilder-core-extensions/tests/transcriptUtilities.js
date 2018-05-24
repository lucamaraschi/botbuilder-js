/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const url = require('url');
const promisify = require('util').promisify;
const readFileAsync = promisify(fs.readFile);
const request = require("request");
const unzip = require('unzip');
const rimraf = require('rimraf');

const chatdown = require('chatdown');

const { TestAdapter, MemoryStorage, UserState, ConversationState, BotStateSet } = require('../');

// Exports
module.exports = {
    assertBotLogicWithBotBuilderTranscript: assertBotLogicWithBotBuilderTranscript,
    assertBotLogicWithTranscript: assertBotLogicWithTranscript,
    getActivitiesFromTranscript: getActivitiesFromTranscript,
    getActivitiesFromChat: getActivitiesFromChat
};


/**
 * Loads a list of activities from a .transcript file.
 * @param {string} transcriptFilePath Relative or absolute path to .transcript file.
 */
function getActivitiesFromTranscript(transcriptFilePath) {
    return readFileAsync(transcriptFilePath, { encoding: 'utf8' })
        .then(transcript => JSON.parse(transcript));
}

/**
 * Loads a list of activities from a .chat file.
 * @param {string} chatFilePath Relative or absolute path to .chat file.
 */
function getActivitiesFromChat(chatFilePath) {
    return readFileAsync(chatFilePath, { encoding: 'utf8' })
        .then(chat => chatdown(chat, { in: chatFilePath }))
        .then(activities => {
            // Clean the last line break (\n) from the last activity.text
            // TODO: Remove once issue is resolved: https://github.com/Microsoft/botbuilder-tools/issues/200
            var last = activities[activities.length - 1];
            if (last) {
                last.text = last.text.trimRight('\n');
            }

            return activities;
        })
}

/**
 * Creates a Mocha Test definition (Mocha.ITestDefinition) that will use the TestAdapter to test a bot logic against the specified transcript file.
 * Optionally, pass a third parameter (as function) to register middleware into the TestAdapter.
 * @param {string} transcriptPath Path to the transcript file. Can be a .chat or .transcript file.
 * @param {function} botLogicFactoryFun Function which accepts conversationState and userState and should return the bots logic to test.
 * @param {function} middlewareRegistrationFun (Optional) Function which accepts the testAdapter, conversationState and userState.
 */
function assertBotLogicWithBotBuilderTranscript(relativeTranscriptPath, botLogicFactoryFun, middlewareRegistrationFun) {
    return function (mochaDoneCallback) {

        checkTranscriptResourcesExist()
            .then(transcriptsBasePath => {
                var transcriptPath = path.join(transcriptsBasePath, relativeTranscriptPath);
                assertBotLogicWithTranscript(transcriptPath, botLogicFactoryFun, middlewareRegistrationFun)(mochaDoneCallback)
            }).catch(mochaDoneCallback);
    }
}

/**
 * Creates a Mocha Test definition (Mocha.ITestDefinition) that will use the TestAdapter to test a bot logic against the specified transcript file.
 * Optionally, pass a third parameter (as function) to register middleware into the TestAdapter.
 * @param {string} transcriptPath Path to the transcript file. Can be a .chat or .transcript file.
 * @param {function} botLogicFactoryFun Function which accepts conversationState and userState and should return the bots logic to test.
 * @param {function} middlewareRegistrationFun (Optional) Function which accepts the testAdapter, conversationState and userState.
 */
function assertBotLogicWithTranscript(transcriptPath, botLogicFactoryFun, middlewareRegistrationFun) {
    var loadFun = transcriptPath.endsWith('.chat')
        ? getActivitiesFromChat
        : getActivitiesFromTranscript;

    // return a Mocha Test Definition, which accepts the done callback to indicate success or error
    return function (done) {
        loadFun(transcriptPath).then(activities => {

            // State
            const storage = new MemoryStorage();
            const conversationState = new ConversationState(storage);
            const userState = new UserState(storage);
            const state = new BotStateSet(conversationState, userState);

            // Bot logic + adapter
            var botLogic = botLogicFactoryFun(conversationState, userState)
            var adapter = new TestAdapter(botLogic);
            adapter.use(state);

            // Middleware registration
            if (typeof middlewareRegistrationFun === 'function') {
                middlewareRegistrationFun(adapter, conversationState, userState);
            }

            // Assert chain of activities
            return adapter.testActivities(activities)
                .then(done)
                .catch(done);

        }).catch(done);
    }
}


// **** PRIVATE **** //

function checkTranscriptResourcesExist() {
    var transcriptsLocation = process.env['BOTBUILDER_TRANSCRIPTS_LOCATION'] || './';
    return isUrl(transcriptsLocation)
        ? downloadAndExtractOnce(transcriptsLocation)               // Download and extract transcript from repo, fulfill Promise with extraction path
        : Promise.resolve(transcriptsLocation);                     // FS, return the environment variable (or default to current directory)
}

const resourcePromises = {};
function downloadAndExtractOnce(url) {
    if (!resourcePromises[url]) {
        resourcePromises[url] = new Promise((resolve, reject) => {

            console.log(`\tDownloading BotBuilder Transcripts from ${url}`);
            var outputPath = path.join(os.tmpdir(), 'botbuilder-transcripts');

            // remove previous unzipped transcripts
            rimraf(outputPath, () => {

                // download stream
                var zipPath = path.resolve(path.join(os.tmpdir(), 'botbuilder-transcripts.zip'));
                var writeStream = fs.createWriteStream(zipPath);

                // download
                request.get(url)
                    .on('end', function () {
                        // unzip
                        console.log(`\tUnzipping ${zipPath} into ${outputPath}`);
                        decompressZip(zipPath, outputPath, function (unzipErr) {

                            fs.unlinkSync(zipPath); // delete zip
                            if (unzipErr) {
                                // error while extracting
                                return reject(unzipErr);
                            }

                            // get branch's inner folder
                            var childDirectories = getDirectories(outputPath);
                            var firstDirectory = childDirectories[0];
                            if (!firstDirectory) {
                                return reject('Downloaded ZIP did not contain a branch folder.');
                            }

                            console.log(`\tTranscripts extracted at ${firstDirectory}`);
                            return resolve(firstDirectory);
                        });
                    })
                    .on('error', e => reject(e))            // reject on download error
                    .pipe(writeStream);
            });
        });
    }

    return resourcePromises[url];
}

const isUrl = (possibleUrl) => {
    try {
        new url.URL(possibleUrl);
        return true;
    } catch (e) {
        return false;
    }
}

const decompressZip = (inputPath, outputPath, callback) =>
    fs.createReadStream(inputPath)
        .pipe(unzip.Extract({ path: outputPath }))
        .on('close', callback)
        .on('error', callback)

const isDirectory = source => fs.lstatSync(source).isDirectory();
const getDirectories = source =>
    fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectory)