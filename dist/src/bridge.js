"use strict";
/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
// tslint:disable:arrow-parens
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const puppeteer_1 = require("puppeteer");
const state_switch_1 = __importDefault(require("state-switch"));
const xml2js_1 = require("xml2js");
/* tslint:disable:no-var-requires */
// const retryPromise  = require('retry-promise').default
const config_1 = require("./config");
const pure_function_helpers_1 = require("./pure-function-helpers");
class Bridge extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        config_1.log.verbose('PuppetPuppeteerBridge', 'constructor()');
        this.state = new state_switch_1.default('PuppetPuppeteerBridge', config_1.log);
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'start()');
            this.state.on('pending');
            try {
                this.browser = yield this.initBrowser();
                config_1.log.verbose('PuppetPuppeteerBridge', 'start() initBrowser() done');
                this.on('load', this.onLoad.bind(this));
                const ready = new Promise(resolve => this.once('ready', resolve));
                this.page = yield this.initPage(this.browser);
                yield ready;
                this.state.on(true);
                config_1.log.verbose('PuppetPuppeteerBridge', 'start() initPage() done');
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'start() exception: %s', e);
                this.state.off(true);
                try {
                    if (this.page) {
                        yield this.page.close();
                    }
                    if (this.browser) {
                        yield this.browser.close();
                    }
                }
                catch (e2) {
                    config_1.log.error('PuppetPuppeteerBridge', 'start() exception %s, close page/browser exception %s', e, e2);
                }
                this.emit('error', e);
                throw e;
            }
        });
    }
    initBrowser() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'initBrowser()');
            const headless = this.options.head ? false : true;
            const browser = yield puppeteer_1.launch({
                args: [
                    '--audio-output-channels=0',
                    '--disable-default-apps',
                    '--disable-extensions',
                    '--disable-translate',
                    '--disable-gpu',
                    '--disable-setuid-sandbox',
                    '--disable-sync',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-sandbox',
                ],
                headless,
            });
            const version = yield browser.version();
            config_1.log.verbose('PuppetPuppeteerBridge', 'initBrowser() version: %s', version);
            return browser;
        });
    }
    onDialog(dialog) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.warn('PuppetPuppeteerBridge', 'onDialog() page.on(dialog) type:%s message:%s', dialog.type, dialog.message());
            try {
                // XXX: Which ONE is better?
                yield dialog.accept();
                // await dialog.dismiss()
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'onDialog() dialog.dismiss() reject: %s', e);
            }
            this.emit('error', new Error(`${dialog.type}(${dialog.message()})`));
        });
    }
    onLoad(page) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'onLoad() page.url=%s', page.url());
            if (this.state.off()) {
                config_1.log.verbose('PuppetPuppeteerBridge', 'onLoad() OFF state detected. NOP');
                return; // reject(new Error('onLoad() OFF state detected'))
            }
            try {
                const emitExist = yield page.evaluate(() => {
                    return typeof window.wechatyPuppetBridgeEmit === 'function';
                });
                if (!emitExist) {
                    /**
                     * expose window.wechatyPuppetBridgeEmit at here.
                     * enable wechaty-bro.js to emit message to bridge
                     */
                    yield page.exposeFunction('wechatyPuppetBridgeEmit', this.emit.bind(this));
                }
                yield this.readyAngular(page);
                yield this.inject(page);
                yield this.clickSwitchAccount(page);
                this.emit('ready');
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'onLoad() exception: %s', e);
                yield page.close();
                this.emit('error', e);
            }
        });
    }
    initPage(browser) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'initPage()');
            // set this in time because the following callbacks
            // might be called before initPage() return.
            const page = this.page = yield browser.newPage();
            page.on('error', e => this.emit('error', e));
            page.on('dialog', this.onDialog.bind(this));
            const cookieList = (yield this.options.memory.get(config_1.MEMORY_SLOT));
            const url = this.entryUrl(cookieList);
            config_1.log.verbose('PuppetPuppeteerBridge', 'initPage() before page.goto(url)');
            // Does this related to(?) the CI Error: exception: Navigation Timeout Exceeded: 30000ms exceeded
            yield page.goto(url);
            config_1.log.verbose('PuppetPuppeteerBridge', 'initPage() after page.goto(url)');
            if (cookieList && cookieList.length) {
                yield page.setCookie(...cookieList);
                config_1.log.silly('PuppetPuppeteerBridge', 'initPage() page.setCookie() %s cookies set back', cookieList.length);
            }
            page.on('load', () => this.emit('load', page));
            yield page.reload(); // reload page to make effect of the new cookie.
            return page;
        });
    }
    readyAngular(page) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'readyAngular()');
            try {
                yield page.waitForFunction(`typeof window.angular !== 'undefined'`);
            }
            catch (e) {
                config_1.log.verbose('PuppetPuppeteerBridge', 'readyAngular() exception: %s', e);
                const blockedMessage = yield this.testBlockedMessage();
                if (blockedMessage) { // Wechat Account Blocked
                    // TODO: advertise for puppet-padchat
                    config_1.log.info('PuppetPuppeteerBridge', `

        Please see: Account Login Issue <https://github.com/Chatie/wechaty/issues/872>

        `);
                    throw new Error(blockedMessage);
                }
                else {
                    throw e;
                }
            }
        });
    }
    inject(page) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'inject()');
            const WECHATY_BRO_JS_FILE = path_1.default.join(__dirname, 'wechaty-bro.js');
            try {
                const sourceCode = fs_1.default.readFileSync(WECHATY_BRO_JS_FILE)
                    .toString();
                let retObj = yield page.evaluate(sourceCode);
                if (retObj && /^(2|3)/.test(retObj.code.toString())) {
                    // HTTP Code 2XX & 3XX
                    config_1.log.silly('PuppetPuppeteerBridge', 'inject() eval(Wechaty) return code[%d] message[%s]', retObj.code, retObj.message);
                }
                else { // HTTP Code 4XX & 5XX
                    throw new Error('execute injectio error: ' + retObj.code + ', ' + retObj.message);
                }
                retObj = yield this.proxyWechaty('init');
                if (retObj && /^(2|3)/.test(retObj.code.toString())) {
                    // HTTP Code 2XX & 3XX
                    config_1.log.silly('PuppetPuppeteerBridge', 'inject() Wechaty.init() return code[%d] message[%s]', retObj.code, retObj.message);
                }
                else { // HTTP Code 4XX & 5XX
                    throw new Error('execute proxyWechaty(init) error: ' + retObj.code + ', ' + retObj.message);
                }
                const SUCCESS_CIPHER = 'ding() OK!';
                const future = new Promise(resolve => this.once('dong', resolve));
                this.ding(SUCCESS_CIPHER);
                const r = yield future;
                if (r !== SUCCESS_CIPHER) {
                    throw new Error('fail to get right return from call ding()');
                }
                config_1.log.silly('PuppetPuppeteerBridge', 'inject() ding success');
            }
            catch (e) {
                config_1.log.verbose('PuppetPuppeteerBridge', 'inject() exception: %s. stack: %s', e.message, e.stack);
                throw e;
            }
        });
    }
    logout() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'logout()');
            try {
                return yield this.proxyWechaty('logout');
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'logout() exception: %s', e.message);
                throw e;
            }
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'stop()');
            if (!this.page) {
                throw new Error('no page');
            }
            if (!this.browser) {
                throw new Error('no browser');
            }
            this.state.off('pending');
            try {
                yield this.page.close();
                config_1.log.silly('PuppetPuppeteerBridge', 'stop() page.close()-ed');
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteerBridge', 'stop() page.close() exception: %s', e);
            }
            try {
                yield this.browser.close();
                config_1.log.silly('PuppetPuppeteerBridge', 'stop() browser.close()-ed');
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteerBridge', 'stop() browser.close() exception: %s', e);
            }
            this.state.off(true);
        });
    }
    getUserName() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getUserName()');
            try {
                const userName = yield this.proxyWechaty('getUserName');
                return userName;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'getUserName() exception: %s', e.message);
                throw e;
            }
        });
    }
    contactAlias(contactId, alias) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.proxyWechaty('contactRemark', contactId, alias);
            }
            catch (e) {
                config_1.log.verbose('PuppetPuppeteerBridge', 'contactRemark() exception: %s', e.message);
                // Issue #509 return false instead of throw when contact is not a friend.
                // throw e
                config_1.log.warn('PuppetPuppeteerBridge', 'contactRemark() does not work on contact is not a friend');
                return false;
            }
        });
    }
    contactList() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.proxyWechaty('contactList');
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'contactList() exception: %s', e.message);
                throw e;
            }
        });
    }
    roomList() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.proxyWechaty('roomList');
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'roomList() exception: %s', e.message);
                throw e;
            }
        });
    }
    roomDelMember(roomId, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!roomId || !contactId) {
                throw new Error('no roomId or contactId');
            }
            try {
                return yield this.proxyWechaty('roomDelMember', roomId, contactId);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'roomDelMember(%s, %s) exception: %s', roomId, contactId, e.message);
                throw e;
            }
        });
    }
    roomAddMember(roomId, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'roomAddMember(%s, %s)', roomId, contactId);
            if (!roomId || !contactId) {
                throw new Error('no roomId or contactId');
            }
            try {
                return yield this.proxyWechaty('roomAddMember', roomId, contactId);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'roomAddMember(%s, %s) exception: %s', roomId, contactId, e.message);
                throw e;
            }
        });
    }
    roomModTopic(roomId, topic) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!roomId) {
                throw new Error('no roomId');
            }
            try {
                yield this.proxyWechaty('roomModTopic', roomId, topic);
                return topic;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'roomModTopic(%s, %s) exception: %s', roomId, topic, e.message);
                throw e;
            }
        });
    }
    roomCreate(contactIdList, topic) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!contactIdList || !Array.isArray(contactIdList)) {
                throw new Error('no valid contactIdList');
            }
            try {
                const roomId = yield this.proxyWechaty('roomCreate', contactIdList, topic);
                if (typeof roomId === 'object') {
                    // It is a Error Object send back by callback in browser(WechatyBro)
                    throw roomId;
                }
                return roomId;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'roomCreate(%s) exception: %s', contactIdList, e.message);
                throw e;
            }
        });
    }
    verifyUserRequest(contactId, hello) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'verifyUserRequest(%s, %s)', contactId, hello);
            if (!contactId) {
                throw new Error('no valid contactId');
            }
            try {
                return yield this.proxyWechaty('verifyUserRequest', contactId, hello);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'verifyUserRequest(%s, %s) exception: %s', contactId, hello, e.message);
                throw e;
            }
        });
    }
    verifyUserOk(contactId, ticket) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'verifyUserOk(%s, %s)', contactId, ticket);
            if (!contactId || !ticket) {
                throw new Error('no valid contactId or ticket');
            }
            try {
                return yield this.proxyWechaty('verifyUserOk', contactId, ticket);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'verifyUserOk(%s, %s) exception: %s', contactId, ticket, e.message);
                throw e;
            }
        });
    }
    send(toUserName, text) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'send(%s, %s)', toUserName, text);
            if (!toUserName) {
                throw new Error('UserName not found');
            }
            if (!text) {
                throw new Error('cannot say nothing');
            }
            try {
                const ret = yield this.proxyWechaty('send', toUserName, text);
                if (!ret) {
                    throw new Error('send fail');
                }
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'send() exception: %s', e.message);
                throw e;
            }
        });
    }
    getMsgImg(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getMsgImg(%s)', id);
            try {
                return yield this.proxyWechaty('getMsgImg', id);
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getMsgImg, %d) exception: %s', id, e.message);
                throw e;
            }
        });
    }
    getMsgEmoticon(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getMsgEmoticon(%s)', id);
            try {
                return yield this.proxyWechaty('getMsgEmoticon', id);
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getMsgEmoticon, %d) exception: %s', id, e.message);
                throw e;
            }
        });
    }
    getMsgVideo(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getMsgVideo(%s)', id);
            try {
                return yield this.proxyWechaty('getMsgVideo', id);
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getMsgVideo, %d) exception: %s', id, e.message);
                throw e;
            }
        });
    }
    getMsgVoice(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getMsgVoice(%s)', id);
            try {
                return yield this.proxyWechaty('getMsgVoice', id);
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getMsgVoice, %d) exception: %s', id, e.message);
                throw e;
            }
        });
    }
    getMsgPublicLinkImg(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getMsgPublicLinkImg(%s)', id);
            try {
                return yield this.proxyWechaty('getMsgPublicLinkImg', id);
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getMsgPublicLinkImg, %d) exception: %s', id, e.message);
                throw e;
            }
        });
    }
    getMessage(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield config_1.retry((retryException, attempt) => __awaiter(this, void 0, void 0, function* () {
                    config_1.log.silly('PuppetPuppeteerBridge', 'getMessage(%s) retry attempt %d', id, attempt);
                    try {
                        const rawPayload = yield this.proxyWechaty('getMessage', id);
                        if (rawPayload && Object.keys(rawPayload).length > 0) {
                            return rawPayload;
                        }
                        throw new Error('got empty return value at attempt: ' + attempt);
                    }
                    catch (e) {
                        config_1.log.verbose('PuppetPuppeteerBridge', 'getMessage() proxyWechaty(getMessage, %s) exception: %s', id, e.message);
                        retryException(e);
                    }
                }));
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'promiseRetry() getContact() finally FAIL: %s', e.message);
                throw e;
            }
        });
    }
    getContact(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield config_1.retry((retryException, attempt) => __awaiter(this, void 0, void 0, function* () {
                    config_1.log.silly('PuppetPuppeteerBridge', 'getContact(%s) retry attempt %d', id, attempt);
                    try {
                        const rawPayload = yield this.proxyWechaty('getContact', id);
                        if (rawPayload && Object.keys(rawPayload).length > 0) {
                            return rawPayload;
                        }
                        throw new Error('got empty return value at attempt: ' + attempt);
                    }
                    catch (e) {
                        config_1.log.verbose('PuppetPuppeteerBridge', 'getContact() proxyWechaty(getContact, %s) exception: %s', id, e.message);
                        retryException(e);
                    }
                }));
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'promiseRetry() getContact() finally FAIL: %s', e.message);
                throw e;
            }
            /////////////////////////////////
        });
    }
    getBaseRequest() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getBaseRequest()');
            try {
                return yield this.proxyWechaty('getBaseRequest');
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getBaseRequest) exception: %s', e.message);
                throw e;
            }
        });
    }
    getPassticket() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getPassticket()');
            try {
                return yield this.proxyWechaty('getPassticket');
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getPassticket) exception: %s', e.message);
                throw e;
            }
        });
    }
    getCheckUploadUrl() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getCheckUploadUrl()');
            try {
                return yield this.proxyWechaty('getCheckUploadUrl');
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getCheckUploadUrl) exception: %s', e.message);
                throw e;
            }
        });
    }
    getUploadMediaUrl() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'getUploadMediaUrl()');
            try {
                return yield this.proxyWechaty('getUploadMediaUrl');
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(getUploadMediaUrl) exception: %s', e.message);
                throw e;
            }
        });
    }
    sendMedia(mediaData) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'sendMedia(mediaData)');
            if (!mediaData.ToUserName) {
                throw new Error('UserName not found');
            }
            if (!mediaData.MediaId) {
                throw new Error('cannot say nothing');
            }
            try {
                return yield this.proxyWechaty('sendMedia', mediaData);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'sendMedia() exception: %s', e.message);
                throw e;
            }
        });
    }
    forward(baseData, patchData) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'forward()');
            if (!baseData.ToUserName) {
                throw new Error('UserName not found');
            }
            if (!patchData.MMActualContent && !patchData.MMSendContent && !patchData.Content) {
                throw new Error('cannot say nothing');
            }
            try {
                return yield this.proxyWechaty('forward', baseData, patchData);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'forward() exception: %s', e.message);
                throw e;
            }
        });
    }
    /**
     * Proxy Call to Wechaty in Bridge
     */
    proxyWechaty(wechatyFunc, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.silly('PuppetPuppeteerBridge', 'proxyWechaty(%s%s)', wechatyFunc, args.length === 0
                ? ''
                : ', ' + args.join(', '));
            if (!this.page) {
                throw new Error('no page');
            }
            try {
                const noWechaty = yield this.page.evaluate(() => {
                    return typeof WechatyBro === 'undefined';
                });
                if (noWechaty) {
                    const e = new Error('there is no WechatyBro in browser(yet)');
                    throw e;
                }
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteerBridge', 'proxyWechaty() noWechaty exception: %s', e);
                throw e;
            }
            const argsEncoded = Buffer.from(encodeURIComponent(JSON.stringify(args))).toString('base64');
            // see: http://blog.sqrtthree.com/2015/08/29/utf8-to-b64/
            const argsDecoded = `JSON.parse(decodeURIComponent(window.atob('${argsEncoded}')))`;
            const wechatyScript = `
      WechatyBro
        .${wechatyFunc}
        .apply(
          undefined,
          ${argsDecoded},
        )
    `.replace(/[\n\s]+/, ' ');
            // log.silly('PuppetPuppeteerBridge', 'proxyWechaty(%s, ...args) %s', wechatyFunc, wechatyScript)
            // console.log('proxyWechaty wechatyFunc args[0]: ')
            // console.log(args[0])
            try {
                const ret = yield this.page.evaluate(wechatyScript);
                return ret;
            }
            catch (e) {
                config_1.log.verbose('PuppetPuppeteerBridge', 'proxyWechaty(%s, %s) ', wechatyFunc, args.join(', '));
                config_1.log.warn('PuppetPuppeteerBridge', 'proxyWechaty() exception: %s', e.message);
                throw e;
            }
        });
    }
    ding(data) {
        config_1.log.verbose('PuppetPuppeteerBridge', 'ding(%s)', data || '');
        this.proxyWechaty('ding', data)
            .then(dongData => {
            this.emit('dong', dongData);
        })
            .catch(e => {
            config_1.log.error('PuppetPuppeteerBridge', 'ding(%s) exception: %s', data, e.message);
            this.emit('error', e);
        });
    }
    preHtmlToXml(text) {
        config_1.log.verbose('PuppetPuppeteerBridge', 'preHtmlToXml()');
        const preRegex = /^<pre[^>]*>([^<]+)<\/pre>$/i;
        const matches = text.match(preRegex);
        if (!matches) {
            return text;
        }
        return pure_function_helpers_1.unescapeHtml(matches[1]);
    }
    innerHTML() {
        return __awaiter(this, void 0, void 0, function* () {
            const html = yield this.evaluate(() => {
                return window.document.body.innerHTML;
            });
            return html;
        });
    }
    /**
     * Throw if there's a blocked message
     */
    testBlockedMessage(text) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!text) {
                text = yield this.innerHTML();
            }
            if (!text) {
                throw new Error('testBlockedMessage() no text found!');
            }
            const textSnip = text.substr(0, 50).replace(/\n/, '');
            config_1.log.verbose('PuppetPuppeteerBridge', 'testBlockedMessage(%s)', textSnip);
            let obj;
            try {
                // see unit test for detail
                const tryXmlText = this.preHtmlToXml(text);
                // obj = JSON.parse(toJson(tryXmlText))
                obj = yield new Promise((resolve, reject) => {
                    xml2js_1.parseString(tryXmlText, { explicitArray: false }, (err, result) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(result);
                    });
                });
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteerBridge', 'testBlockedMessage() toJson() exception: %s', e);
                return false;
            }
            if (!obj) {
                // FIXME: when will this happen?
                config_1.log.warn('PuppetPuppeteerBridge', 'testBlockedMessage() toJson(%s) return empty obj', textSnip);
                return false;
            }
            if (!obj.error) {
                return false;
            }
            const ret = +obj.error.ret;
            const message = obj.error.message;
            config_1.log.warn('PuppetPuppeteerBridge', 'testBlockedMessage() error.ret=%s', ret);
            if (ret === 1203) {
                // <error>
                // <ret>1203</ret>
                // <message>当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过手机客户端或者windows微信登录。</message>
                // </error>
                return message;
            }
            return message; // other error message
            // return new Promise<string | false>(resolve => {
            //   parseString(tryXmlText, { explicitArray: false }, (err, obj: BlockedMessage) => {
            //     if (err) {  // HTML can not be parsed to JSON
            //       return resolve(false)
            //     }
            //     if (!obj) {
            //       // FIXME: when will this happen?
            //       log.warn('PuppetPuppeteerBridge', 'testBlockedMessage() parseString(%s) return empty obj', textSnip)
            //       return resolve(false)
            //     }
            //     if (!obj.error) {
            //       return resolve(false)
            //     }
            //     const ret     = +obj.error.ret
            //     const message =  obj.error.message
            //     log.warn('PuppetPuppeteerBridge', 'testBlockedMessage() error.ret=%s', ret)
            //     if (ret === 1203) {
            //       // <error>
            //       // <ret>1203</ret>
            //       // <message>当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过手机客户端或者windows微信登录。</message>
            //       // </error>
            //       return resolve(message)
            //     }
            //     return resolve(message) // other error message
            //   })
            // })
        });
    }
    clickSwitchAccount(page) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'clickSwitchAccount()');
            // https://github.com/GoogleChrome/puppeteer/issues/537#issuecomment-334918553
            // async function listXpath(thePage: Page, xpath: string): Promise<ElementHandle[]> {
            //   log.verbose('PuppetPuppeteerBridge', 'clickSwitchAccount() listXpath()')
            //   try {
            //     const nodeHandleList = await (thePage as any).evaluateHandle(xpathInner => {
            //       const nodeList: Node[] = []
            //       const query = document.evaluate(xpathInner, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
            //       for (let i = 0, length = query.snapshotLength; i < length; ++i) {
            //         nodeList.push(query.snapshotItem(i))
            //       }
            //       return nodeList
            //     }, xpath)
            //     const properties = await nodeHandleList.getProperties()
            //     const elementHandleList:  ElementHandle[] = []
            //     const releasePromises:    Promise<void>[] = []
            //     for (const property of properties.values()) {
            //       const element = property.asElement()
            //       if (element)
            //         elementHandleList.push(element)
            //       else
            //         releasePromises.push(property.dispose())
            //     }
            //     await Promise.all(releasePromises)
            //     return elementHandleList
            //   } catch (e) {
            //     log.verbose('PuppetPuppeteerBridge', 'clickSwitchAccount() listXpath() exception: %s', e)
            //     return []
            //   }
            // }
            // TODO: use page.$x() (with puppeteer v1.1 or above) to replace DIY version of listXpath() instead.
            // See: https://github.com/GoogleChrome/puppeteer/blob/v1.1.0/docs/api.md#pagexexpression
            const XPATH_SELECTOR = `//div[contains(@class,'association') and contains(@class,'show')]/a[@ng-click='qrcodeLogin()']`;
            try {
                // const [button] = await listXpath(page, XPATH_SELECTOR)
                const [button] = yield page.$x(XPATH_SELECTOR);
                if (button) {
                    yield button.click();
                    config_1.log.silly('PuppetPuppeteerBridge', 'clickSwitchAccount() clicked!');
                    return true;
                }
                else {
                    config_1.log.silly('PuppetPuppeteerBridge', 'clickSwitchAccount() button not found');
                    return false;
                }
            }
            catch (e) {
                config_1.log.silly('PuppetPuppeteerBridge', 'clickSwitchAccount() exception: %s', e);
                throw e;
            }
        });
    }
    hostname() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'hostname()');
            if (!this.page) {
                throw new Error('no page');
            }
            try {
                const hostname = yield this.page.evaluate(() => window.location.hostname);
                config_1.log.silly('PuppetPuppeteerBridge', 'hostname() got %s', hostname);
                return hostname;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'hostname() exception: %s', e);
                this.emit('error', e);
                return null;
            }
        });
    }
    cookies(cookieList) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.page) {
                throw new Error('no page');
            }
            if (cookieList) {
                try {
                    yield this.page.setCookie(...cookieList);
                }
                catch (e) {
                    config_1.log.error('PuppetPuppeteerBridge', 'cookies(%s) reject: %s', cookieList, e);
                    this.emit('error', e);
                }
                return;
            }
            else {
                // FIXME: puppeteer typing bug
                cookieList = (yield this.page.cookies());
                return cookieList;
            }
        });
    }
    /**
     * name
     */
    entryUrl(cookieList) {
        config_1.log.verbose('PuppetPuppeteerBridge', 'cookieDomain(%s)', cookieList);
        const DEFAULT_URL = 'https://wx.qq.com';
        if (!cookieList || cookieList.length === 0) {
            config_1.log.silly('PuppetPuppeteerBridge', 'cookieDomain() no cookie, return default %s', DEFAULT_URL);
            return DEFAULT_URL;
        }
        const wxCookieList = cookieList.filter(c => /^webwx_auth_ticket|webwxuvid$/.test(c.name));
        if (!wxCookieList.length) {
            config_1.log.silly('PuppetPuppeteerBridge', 'cookieDomain() no valid cookie, return default hostname');
            return DEFAULT_URL;
        }
        let domain = wxCookieList[0].domain;
        if (!domain) {
            config_1.log.silly('PuppetPuppeteerBridge', 'cookieDomain() no valid domain in cookies, return default hostname');
            return DEFAULT_URL;
        }
        domain = domain.slice(1);
        if (domain === 'wechat.com') {
            domain = 'web.wechat.com';
        }
        let url;
        if (/^http/.test(domain)) {
            url = domain;
        }
        else {
            // Protocol error (Page.navigate): Cannot navigate to invalid URL undefined
            url = `https://${domain}`;
        }
        config_1.log.silly('PuppetPuppeteerBridge', 'cookieDomain() got %s', url);
        return url;
    }
    reload() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteerBridge', 'reload()');
            if (!this.page) {
                throw new Error('no page');
            }
            yield this.page.reload();
            return;
        });
    }
    evaluate(fn, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.silly('PuppetPuppeteerBridge', 'evaluate()');
            if (!this.page) {
                throw new Error('no page');
            }
            try {
                return yield this.page.evaluate(fn, ...args);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteerBridge', 'evaluate() exception: %s', e);
                this.emit('error', e);
                return null;
            }
        });
    }
}
exports.Bridge = Bridge;
exports.default = Bridge;
//# sourceMappingURL=bridge.js.map