/**
 * @module botbuilder
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { TurnContext } from './turnContext';
import { Middleware } from './middlewareSet';
import { BotState } from './botState';
import { StoreItem } from './storage';
/**
 * Middleware that will call `read()` and `write()` in parallel on multiple `BotState`
 * instances.
 *
 * @remarks
 * This example shows boilerplate code for reading and writing conversation and user state within
 * a bot:
 *
 * ```JavaScript
 * const { BotStateSet, ConversationState, UserState, MemoryStorage } = require('botbuilder');
 *
 * const storage = new MemoryStorage();
 * const conversationState = new ConversationState(storage);
 * const userState = new UserState(storage);
 * adapter.use(new BotStateSet(conversationState, userState));
 *
 * server.post('/api/messages', (req, res) => {
 *    adapter.processActivity(req, res, async (context) => {
 *       // Get state
 *       const convo = conversationState.get(context);
 *       const user = userState.get(context);
 *
 *       // ... route activity ...
 *
 *    });
 * });
 * ```
 */
export declare class BotStateSet implements Middleware {
    private middleware;
    /**
     * Creates a new BotStateSet instance.
     * @param middleware Zero or more BotState plugins to register.
     */
    constructor(...middleware: BotState[]);
    onTurn(context: TurnContext, next: () => Promise<void>): Promise<void>;
    /**
     * Registers `BotState` middleware plugins with the set.
     * @param middleware One or more BotState plugins to register.
     */
    use(...middleware: BotState[]): this;
    /**
     * Calls `BotState.read()` on all of the BotState plugins in the set.
     *
     * @remarks
     * This will trigger all of the plugins to read in their state in parallel.
     *
     * ```JavaScript
     * await stateSet.readAll(context);
     * ```
     * @param context Context for current turn of conversation with the user.
     * @param force (Optional) If `true` the cache will be bypassed and the state will always be read in directly from storage. Defaults to `false`.
     */
    readAll(context: TurnContext, force?: boolean): Promise<StoreItem[]>;
    /**
     * Calls `BotState.write()` on all of the BotState plugins in the set.
     *
     * @remarks
     * This will trigger all of the plugins to write out their state in parallel.
     *
     * ```JavaScript
     * await stateSet.writeAll(context);
     * ```
     * @param context Context for current turn of conversation with the user.
     * @param force (Optional) if `true` the state will always be written out regardless of its change state. Defaults to `false`.
     */
    writeAll(context: TurnContext, force?: boolean): Promise<void>;
}
