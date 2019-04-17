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
// tslint:disable:member-ordering
// tslint:disable:arrow-parens
// tslint:disable:object-literal-key-quotes
const path_1 = __importDefault(require("path"));
const url_1 = __importDefault(require("url"));
// tslint:disable-next-line
const lru_cache_1 = __importDefault(require("lru-cache"));
const bl_1 = __importDefault(require("bl"));
const md5_1 = __importDefault(require("md5"));
const mime_1 = __importDefault(require("mime"));
const request_1 = __importDefault(require("request"));
const file_box_1 = require("file-box");
const rx_queue_1 = require("rx-queue");
const watchdog_1 = require("watchdog");
const wechaty_puppet_1 = require("wechaty-puppet");
const config_1 = require("./config");
const pure_function_helpers_1 = require("./pure-function-helpers");
const bridge_1 = require("./bridge");
const event_1 = require("./event");
const web_schemas_1 = require("./web-schemas");
class PuppetPuppeteer extends wechaty_puppet_1.Puppet {
    constructor(options = {}) {
        super(options);
        this.options = options;
        this.fileId = 0;
        this.bridge = new bridge_1.Bridge({
            head: config_1.envHead(),
            memory: this.memory,
        });
        this.cacheMessageRawPayload = new lru_cache_1.default({
            dispose(key, val) {
                config_1.log.silly('PuppetPuppeteer', 'constructor() lruOptions.dispose(%s, %s)', key, JSON.stringify(val).substr(0, 140));
            },
            max: 100 * 1000,
            maxAge: 1000 * 60 * 10,
        });
        const SCAN_TIMEOUT = 2 * 60 * 1000; // 2 minutes
        this.scanWatchdog = new watchdog_1.Watchdog(SCAN_TIMEOUT, 'Scan');
        this.initWatchdogForScan();
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', `start() with ${this.memory.name}`);
            this.state.on('pending');
            try {
                /**
                 * Overwrite the memory in bridge
                 * because it could be changed between constructor() and start()
                 */
                this.bridge.options.memory = this.memory;
                // this.initWatchdog()
                // this.initWatchdogForScan()
                this.bridge = yield this.initBridge();
                config_1.log.verbose('PuppetPuppeteer', 'initBridge() done');
                /**
                 *  state must set to `live`
                 *  before feed Watchdog
                 */
                this.state.on(true);
                /**
                 * Feed the dog and start watch
                 */
                const food = {
                    data: 'inited',
                    timeout: 2 * 60 * 1000,
                };
                this.emit('watchdog', food);
                /**
                 * Save cookie for every 5 minutes
                 */
                const throttleQueue = new rx_queue_1.ThrottleQueue(5 * 60 * 1000);
                this.on('watchdog', data => throttleQueue.next(data));
                throttleQueue.subscribe((data) => __awaiter(this, void 0, void 0, function* () {
                    config_1.log.verbose('PuppetPuppeteer', 'start() throttleQueue.subscribe() new item: %s', data);
                    yield this.saveCookie();
                }));
                config_1.log.verbose('PuppetPuppeteer', 'start() done');
                // this.emit('start')
                return;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'start() exception: %s', e);
                // this.state.off(true)
                this.emit('error', e);
                yield this.stop();
                throw e;
            }
        });
    }
    /**
     * Deal with SCAN events
     *
     * if web browser stay at login qrcode page long time,
     * sometimes the qrcode will not refresh, leave there expired.
     * so we need to refresh the page after a while
     */
    initWatchdogForScan() {
        config_1.log.verbose('PuppetPuppeteer', 'initWatchdogForScan()');
        const puppet = this;
        const dog = this.scanWatchdog;
        // clean the dog because this could be re-inited
        // dog.removeAllListeners()
        puppet.on('scan', info => dog.feed({
            data: info,
            type: 'scan',
        }));
        puppet.on('login', user => {
            // dog.feed({
            //   data: user,
            //   type: 'login',
            // })
            // do not monitor `scan` event anymore
            // after user login
            dog.sleep();
        });
        // active monitor again for `scan` event
        puppet.on('logout', user => dog.feed({
            data: user,
            type: 'logout',
        }));
        dog.on('reset', (food, timePast) => __awaiter(this, void 0, void 0, function* () {
            config_1.log.warn('PuppetPuppeteer', 'initScanWatchdog() on(reset) lastFood: %s, timePast: %s', food.data, timePast);
            try {
                yield this.bridge.reload();
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) exception: %s', e);
                try {
                    config_1.log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) try to recover by bridge.{quit,init}()', e);
                    yield this.bridge.stop();
                    yield this.bridge.start();
                    config_1.log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) recover successful');
                }
                catch (e) {
                    config_1.log.error('PuppetPuppeteer', 'initScanWatchdog() on(reset) recover FAIL: %s', e);
                    this.emit('error', e);
                }
            }
        }));
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'stop()');
            if (this.state.off()) {
                config_1.log.warn('PuppetPuppeteer', 'stop() is called on a OFF puppet. await ready(off) and return.');
                yield this.state.ready('off');
                return;
            }
            this.state.off('pending');
            config_1.log.verbose('PuppetPuppeteer', 'stop() make watchdog sleep before do stop');
            /**
             * Clean listeners for `watchdog`
             */
            // this.watchdog.sleep()
            this.scanWatchdog.sleep();
            // this.watchdog.removeAllListeners()
            this.scanWatchdog.removeAllListeners();
            this.removeAllListeners('watchdog');
            try {
                yield this.bridge.stop();
                // register the removeListeners micro task at then end of the task queue
                setImmediate(() => this.bridge.removeAllListeners());
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'this.bridge.quit() exception: %s', e.message);
                throw e;
            }
            finally {
                this.state.off(true);
                // this.emit('stop')
            }
        });
    }
    initBridge() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'initBridge()');
            if (this.state.off()) {
                const e = new Error('initBridge() found targetState != live, no init anymore');
                config_1.log.warn('PuppetPuppeteer', e.message);
                throw e;
            }
            this.bridge.on('dong', data => this.emit('dong', data));
            // this.bridge.on('ding'     , Event.onDing.bind(this))
            this.bridge.on('heartbeat', data => this.emit('watchdog', { type: 'bridge ding', data }));
            this.bridge.on('error', e => this.emit('error', e));
            this.bridge.on('log', event_1.Event.onLog.bind(this));
            this.bridge.on('login', event_1.Event.onLogin.bind(this));
            this.bridge.on('logout', event_1.Event.onLogout.bind(this));
            this.bridge.on('message', event_1.Event.onMessage.bind(this));
            this.bridge.on('scan', event_1.Event.onScan.bind(this));
            this.bridge.on('unload', event_1.Event.onUnload.bind(this));
            try {
                yield this.bridge.start();
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'initBridge() exception: %s', e.message);
                yield this.bridge.stop().catch(e => {
                    config_1.log.error('PuppetPuppeteer', 'initBridge() this.bridge.stop() rejection: %s', e);
                });
                this.emit('error', e);
                throw e;
            }
            return this.bridge;
        });
    }
    messageRawPayloadCache(messageId) {
        config_1.log.silly('PuppetPuppeteer', 'messageRawPayloadCache(id=%s) @ %s', messageId, this);
        if (!messageId) {
            throw new Error('no messageId');
        }
        const cachedRawPayload = this.cacheMessageRawPayload.get(messageId);
        if (cachedRawPayload) {
            config_1.log.silly('PuppetPuppeteer', 'MessageRawPayload(%s) cache HIT', messageId);
        }
        else {
            config_1.log.silly('PuppetPuppeteer', 'MessageRawPayload(%s) cache MISS', messageId);
        }
        return cachedRawPayload;
    }
    messageRawPayload(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const cachedPayload = this.messageRawPayloadCache(id);
            if (cachedPayload) {
                return cachedPayload;
            }
            const rawPayload = yield this.bridge.getMessage(id);
            this.cacheMessageRawPayload.set(id, rawPayload);
            return rawPayload;
        });
    }
    messageRawPayloadParser(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'messageRawPayloadParser(%s) @ %s', rawPayload, this);
            const payload = pure_function_helpers_1.messageRawPayloadParser(rawPayload);
            return payload;
        });
    }
    messageFile(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const rawPayload = yield this.messageRawPayload(messageId);
            const fileBox = yield this.messageRawPayloadToFile(rawPayload);
            return fileBox;
        });
    }
    messageUrl(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return wechaty_puppet_1.throwUnsupportedError();
        });
    }
    messageRawPayloadToFile(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = yield this.messageRawPayloadToUrl(rawPayload);
            if (!url) {
                throw new Error('no url for type ' + wechaty_puppet_1.MessageType[rawPayload.MsgType]);
            }
            // use http instead of https, because https will only success on the very first request!
            url = url.replace(/^https/i, 'http');
            const parsedUrl = url_1.default.parse(url);
            const msgFileName = pure_function_helpers_1.messageFilename(rawPayload);
            if (!msgFileName) {
                throw new Error('no filename');
            }
            const cookies = yield this.cookies();
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) '
                    + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
                // Accept: 'image/webp,image/*,*/*;q=0.8',
                // Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', //  MsgType.IMAGE | VIDEO
                Accept: '*/*',
                Host: parsedUrl.hostname,
                // Referer: protocol + '//wx.qq.com/',
                Referer: url,
                // 'Upgrade-Insecure-Requests': 1, // MsgType.VIDEO | IMAGE
                Range: 'bytes=0-',
                // 'Accept-Encoding': 'gzip, deflate, sdch',
                // 'Accept-Encoding': 'gzip, deflate, sdch, br', // MsgType.IMAGE | VIDEO
                'Accept-Encoding': 'identity;q=1, *;q=0',
                'Accept-Language': 'zh-CN,zh;q=0.8',
                // 'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.6,en-US;q=0.4,en;q=0.2',
                /**
                 * pgv_pvi=6639183872; pgv_si=s8359147520; webwx_data_ticket=gSeBbuhX+0kFdkXbgeQwr6Ck
                 */
                Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
            };
            const fileBox = file_box_1.FileBox.fromUrl(url, msgFileName, headers);
            return fileBox;
        });
    }
    messageSendUrl(to, urlLinkPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            wechaty_puppet_1.throwUnsupportedError();
        });
    }
    /**
     * TODO: Test this function if it could work...
     */
    // public async forward(baseData: MsgRawObj, patchData: MsgRawObj): Promise<boolean> {
    messageForward(receiver, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.silly('PuppetPuppeteer', 'forward(receiver=%s, messageId=%s)', receiver, messageId);
            let rawPayload = yield this.messageRawPayload(messageId);
            // rawPayload = Object.assign({}, rawPayload)
            const newMsg = {};
            const largeFileSize = 25 * 1024 * 1024;
            // let ret = false
            // if you know roomId or userId, you can use `Room.load(roomId)` or `Contact.load(userId)`
            // let sendToList: Contact[] = [].concat(sendTo as any || [])
            // sendToList = sendToList.filter(s => {
            //   if ((s instanceof Room || s instanceof Contact) && s.id) {
            //     return true
            //   }
            //   return false
            // }) as Contact[]
            // if (sendToList.length < 1) {
            //   throw new Error('param must be Room or Contact and array')
            // }
            if (rawPayload.FileSize >= largeFileSize && !rawPayload.Signature) {
                // if has RawObj.Signature, can forward the 25Mb+ file
                config_1.log.warn('MediaMessage', 'forward() Due to webWx restrictions, '
                    + 'more than 25MB of files can not be downloaded and can not be forwarded.');
                throw new Error('forward() Due to webWx restrictions, '
                    + 'more than 25MB of files can not be downloaded and can not be forwarded.');
            }
            newMsg.FromUserName = this.id || '';
            newMsg.isTranspond = true;
            newMsg.MsgIdBeforeTranspond = rawPayload.MsgIdBeforeTranspond || rawPayload.MsgId;
            newMsg.MMSourceMsgId = rawPayload.MsgId;
            // In room msg, the content prefix sender:, need to be removed,
            // otherwise the forwarded sender will display the source message sender,
            // causing self () to determine the error
            newMsg.Content = pure_function_helpers_1.unescapeHtml(rawPayload.Content.replace(/^@\w+:<br\/>/, '')).replace(/^[\w\-]+:<br\/>/, '');
            newMsg.MMIsChatRoom = receiver.roomId ? true : false;
            // The following parameters need to be overridden after calling createMessage()
            rawPayload = Object.assign(rawPayload, newMsg);
            // for (let i = 0; i < sendToList.length; i++) {
            // newMsg.ToUserName = sendToList[i].id
            // // all call success return true
            // ret = (i === 0 ? true : ret) && await config.puppetInstance().forward(m, newMsg)
            // }
            newMsg.ToUserName = receiver.contactId || receiver.roomId;
            // ret = await config.puppetInstance().forward(m, newMsg)
            // return ret
            const baseData = rawPayload;
            const patchData = newMsg;
            try {
                const ret = yield this.bridge.forward(baseData, patchData);
                if (!ret) {
                    throw new Error('forward failed');
                }
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'forward() exception: %s', e.message);
                throw e;
            }
        });
    }
    messageSendText(receiver, text) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'messageSendText(receiver=%s, text=%s)', JSON.stringify(receiver), text);
            let destinationId;
            if (receiver.roomId) {
                destinationId = receiver.roomId;
            }
            else if (receiver.contactId) {
                destinationId = receiver.contactId;
            }
            else {
                throw new Error('PuppetPuppeteer.messageSendText(): message with neither room nor to?');
            }
            config_1.log.silly('PuppetPuppeteer', 'messageSendText() destination: %s, text: %s)', destinationId, text);
            try {
                yield this.bridge.send(destinationId, text);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'messageSendText() exception: %s', e.message);
                throw e;
            }
        });
    }
    login(userId) {
        const _super = Object.create(null, {
            login: { get: () => super.login }
        });
        return __awaiter(this, void 0, void 0, function* () {
            return _super.login.call(this, userId);
        });
    }
    /**
     * logout from browser, then server will emit `logout` event
     */
    logout() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'logout()');
            const user = this.selfId();
            if (!user) {
                config_1.log.warn('PuppetPuppeteer', 'logout() without self()');
                return;
            }
            try {
                yield this.bridge.logout();
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'logout() exception: %s', e.message);
                throw e;
            }
            finally {
                this.id = undefined;
                this.emit('logout', user);
            }
        });
    }
    /**
     *
     * ContactSelf
     *
     *
     */
    contactSelfQrcode() {
        return __awaiter(this, void 0, void 0, function* () {
            return wechaty_puppet_1.throwUnsupportedError();
        });
    }
    contactSelfName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            return wechaty_puppet_1.throwUnsupportedError();
        });
    }
    contactSelfSignature(signature) {
        return __awaiter(this, void 0, void 0, function* () {
            return wechaty_puppet_1.throwUnsupportedError();
        });
    }
    /**
     *
     * Contact
     *
     */
    contactRawPayload(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.silly('PuppetPuppeteer', 'contactRawPayload(%s) @ %s', id, this);
            try {
                const rawPayload = yield this.bridge.getContact(id);
                return rawPayload;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'contactRawPayload(%s) exception: %s', id, e.message);
                throw e;
            }
        });
    }
    contactRawPayloadParser(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.silly('PuppetPuppeteer', 'contactParseRawPayload(Object.keys(payload).length=%d)', Object.keys(rawPayload).length);
            if (!Object.keys(rawPayload).length) {
                config_1.log.error('PuppetPuppeteer', 'contactParseRawPayload(Object.keys(payload).length=%d)', Object.keys(rawPayload).length);
                config_1.log.error('PuppetPuppeteer', 'contactParseRawPayload() got empty rawPayload!');
                throw new Error('empty raw payload');
                // return {
                //   gender: Gender.Unknown,
                //   type:   Contact.Type.Unknown,
                // }
            }
            // this.id = rawPayload.UserName
            // MMActualSender??? MMPeerUserName??? `getUserContact(message.MMActualSender,message.MMPeerUserName).HeadImgUrl`
            // uin:        rawPayload.Uin,    // stable id: 4763975 || getCookie("wxuin")
            return {
                avatar: rawPayload.HeadImgUrl,
                friend: rawPayload.stranger === undefined
                    ? undefined
                    : !rawPayload.stranger,
                star: !!rawPayload.StarFriend,
                address: rawPayload.Alias,
                alias: rawPayload.RemarkName,
                city: rawPayload.City,
                gender: rawPayload.Sex,
                id: rawPayload.UserName,
                name: pure_function_helpers_1.plainText(rawPayload.NickName || ''),
                province: rawPayload.Province,
                signature: rawPayload.Signature,
                weixin: rawPayload.Alias,
                /**
                 * @see 1. https://github.com/Chatie/webwx-app-tracker/blob/
                 *  7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L3243
                 * @see 2. https://github.com/Urinx/WeixinBot/blob/master/README.md
                 * @ignore
                 */
                // tslint:disable-next-line
                type: (!!rawPayload.UserName && !rawPayload.UserName.startsWith('@@') && !!(rawPayload.VerifyFlag & 8))
                    ? wechaty_puppet_1.ContactType.Official
                    : wechaty_puppet_1.ContactType.Personal,
            };
        });
    }
    ding(data) {
        config_1.log.verbose('PuppetPuppeteer', 'ding(%s)', data || '');
        this.bridge.ding(data);
    }
    contactAvatar(contactId, file) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'contactAvatar(%s)', contactId);
            if (file) {
                throw new Error('not support');
            }
            const payload = yield this.contactPayload(contactId);
            if (!payload.avatar) {
                throw new Error('Can not get avatar: no payload.avatar!');
            }
            try {
                const hostname = yield this.hostname();
                const avatarUrl = `http://${hostname}${payload.avatar}&type=big`; // add '&type=big' to get big image
                const cookieList = yield this.cookies();
                config_1.log.silly('PuppeteerContact', 'avatar() url: %s', avatarUrl);
                /**
                 * FileBox headers (will be used in NodeJS.http.get param options)
                 */
                const headers = {
                    cookie: cookieList.map(c => `${c.name}=${c.value}`).join('; '),
                };
                const fileName = (payload.name || 'unknown') + '-avatar.jpg';
                return file_box_1.FileBox.fromUrl(avatarUrl, fileName, headers);
            }
            catch (err) {
                config_1.log.warn('PuppeteerContact', 'avatar() exception: %s', err.stack);
                throw err;
            }
        });
    }
    contactQrcode(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (contactId !== this.selfId()) {
                throw new Error('can not set avatar for others');
            }
            throw new Error('not supported');
            // return await this.bridge.WXqr
        });
    }
    contactAlias(contactId, alias) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof alias === 'undefined') {
                throw new Error('to be implement');
            }
            try {
                const ret = yield this.bridge.contactAlias(contactId, alias);
                if (!ret) {
                    config_1.log.warn('PuppetPuppeteer', 'contactRemark(%s, %s) bridge.contactAlias() return false', contactId, alias);
                    throw new Error('bridge.contactAlias fail');
                }
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'contactRemark(%s, %s) rejected: %s', contactId, alias, e.message);
                throw e;
            }
        });
    }
    contactList() {
        return __awaiter(this, void 0, void 0, function* () {
            const idList = yield this.bridge.contactList();
            return idList;
        });
    }
    /**
     *
     * Room
     *
     */
    roomRawPayload(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'roomRawPayload(%s)', id);
            try {
                let rawPayload;
                // = await this.bridge.getContact(room.id) as PuppeteerRoomRawPayload
                // let currNum = rawPayload.MemberList && rawPayload.MemberList.length || 0
                // let prevNum = room.memberList().length
                // rawPayload && rawPayload.MemberList && this.rawObj.MemberList.length || 0
                let prevLength = 0;
                /**
                 * @todo use Misc.retry() to replace the following loop
                 */
                let ttl = 7;
                while (ttl-- /* && currNum !== prevNum */) {
                    rawPayload = (yield this.bridge.getContact(id));
                    if (rawPayload) {
                        const currLength = rawPayload.MemberList && rawPayload.MemberList.length || 0;
                        config_1.log.silly('PuppetPuppeteer', `roomPayload() this.bridge.getContact(%s) `
                            + `MemberList.length:(prev:%d, curr:%d) at ttl:%d`, id, prevLength, currLength, ttl);
                        if (prevLength === currLength) {
                            config_1.log.silly('PuppetPuppeteer', `roomPayload() puppet.getContact(%s) done at ttl:%d with length:%d`, this.id, ttl, currLength);
                            return rawPayload;
                        }
                        if (currLength >= prevLength) {
                            prevLength = currLength;
                        }
                        else {
                            config_1.log.warn('PuppetPuppeteer', 'roomRawPayload() currLength(%d) <= prevLength(%d) ???', currLength, prevLength);
                        }
                    }
                    config_1.log.silly('PuppetPuppeteer', `roomPayload() puppet.getContact(${id}) retry at ttl:%d`, ttl);
                    yield new Promise(r => setTimeout(r, 1000)); // wait for 1 second
                }
                throw new Error('no payload');
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'roomRawPayload(%s) exception: %s', id, e.message);
                throw e;
            }
        });
    }
    roomRawPayloadParser(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'roomRawPayloadParser(%s)', rawPayload);
            // const payload = await this.roomPayload(rawPayload.UserName)
            // console.log(rawPayload)
            // const memberList = (rawPayload.MemberList || [])
            //                     .map(m => this.Contact.load(m.UserName))
            // await Promise.all(memberList.map(c => c.ready()))
            const id = rawPayload.UserName;
            // const rawMemberList = rawPayload.MemberList || []
            // const memberIdList  = rawMemberList.map(rawMember => rawMember.UserName)
            // const nameMap         = await this.roomParseMap('name'        , rawPayload.MemberList)
            // const roomAliasMap    = await this.roomParseMap('roomAlias'   , rawPayload.MemberList)
            // const contactAliasMap = await this.roomParseMap('contactAlias', rawPayload.MemberList)
            // const aliasDict = {} as { [id: string]: string | undefined }
            // if (Array.isArray(rawPayload.MemberList)) {
            //   rawPayload.MemberList.forEach(rawMember => {
            //     aliasDict[rawMember.UserName] = rawMember.DisplayName
            //   })
            //   // const memberListPayload = await Promise.all(
            //   //   rawPayload.MemberList
            //   //     .map(rawMember => rawMember.UserName)
            //   //     .map(contactId => this.contactPayload(contactId)),
            //   // )
            //   // console.log(memberListPayload)
            //   // memberListPayload.forEach(payload => aliasDict[payload.id] = payload.alias)
            //   // console.log(aliasDict)
            // }
            const memberIdList = rawPayload.MemberList
                ? rawPayload.MemberList.map(m => m.UserName)
                : [];
            const roomPayload = {
                id,
                memberIdList,
                topic: pure_function_helpers_1.plainText(rawPayload.NickName || ''),
            };
            // console.log(roomPayload)
            return roomPayload;
        });
    }
    roomList() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPupppeteer', 'roomList()');
            const idList = yield this.bridge.roomList();
            return idList;
        });
    }
    roomDel(roomId, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.bridge.roomDelMember(roomId, contactId);
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'roomDelMember(%s, %d) rejected: %s', roomId, contactId, e.message);
                throw e;
            }
        });
    }
    roomAvatar(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'roomAvatar(%s)', roomId);
            const payload = yield this.roomPayload(roomId);
            if (payload.avatar) {
                return file_box_1.FileBox.fromUrl(payload.avatar);
            }
            config_1.log.warn('PuppetPuppeteer', 'roomAvatar() avatar not found, use the chatie default.');
            return config_1.qrCodeForChatie();
        });
    }
    roomAdd(roomId, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.bridge.roomAddMember(roomId, contactId);
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'roomAddMember(%s) rejected: %s', contactId, e.message);
                throw e;
            }
        });
    }
    roomTopic(roomId, topic) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!topic) {
                const payload = yield this.roomPayload(roomId);
                return payload.topic;
            }
            try {
                yield this.bridge.roomModTopic(roomId, topic);
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'roomTopic(%s) rejected: %s', topic, e.message);
                throw e;
            }
        });
    }
    roomCreate(contactIdList, topic) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const roomId = yield this.bridge.roomCreate(contactIdList, topic);
                if (!roomId) {
                    throw new Error('PuppetPuppeteer.roomCreate() roomId "' + roomId + '" not found');
                }
                return roomId;
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'roomCreate(%s, %s) rejected: %s', contactIdList.join(','), topic, e.message);
                throw e;
            }
        });
    }
    roomAnnounce(roomId, text) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.warn('PuppetPuppeteer', 'roomAnnounce(%s, %s) not supported', roomId, text ? text : '');
            if (text) {
                return;
            }
            return '';
        });
    }
    roomQuit(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.warn('PuppetPuppeteer', 'roomQuit(%s) not supported by Web API', roomId);
        });
    }
    roomQrcode(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not support ' + roomId);
        });
    }
    roomMemberList(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'roommemberList(%s)', roomId);
            const rawPayload = yield this.roomRawPayload(roomId);
            const memberIdList = (rawPayload.MemberList || [])
                .map(member => member.UserName);
            return memberIdList;
        });
    }
    roomMemberRawPayload(roomId, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'roomMemberRawPayload(%s, %s)', roomId, contactId);
            const rawPayload = yield this.roomRawPayload(roomId);
            const memberPayloadList = rawPayload.MemberList || [];
            const memberPayloadResult = memberPayloadList.filter(payload => payload.UserName === contactId);
            if (memberPayloadResult.length > 0) {
                return memberPayloadResult[0];
            }
            else {
                throw new Error('not found');
            }
        });
    }
    roomMemberRawPayloadParser(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'roomMemberRawPayloadParser(%s)', rawPayload);
            const payload = {
                avatar: rawPayload.HeadImgUrl,
                id: rawPayload.UserName,
                name: rawPayload.NickName,
                roomAlias: rawPayload.DisplayName,
            };
            return payload;
        });
    }
    /**
     *
     * Room Invitation
     *
     */
    roomInvitationAccept(roomInvitationId) {
        return __awaiter(this, void 0, void 0, function* () {
            return wechaty_puppet_1.throwUnsupportedError();
        });
    }
    roomInvitationRawPayload(roomInvitationId) {
        return __awaiter(this, void 0, void 0, function* () {
            return wechaty_puppet_1.throwUnsupportedError();
        });
    }
    roomInvitationRawPayloadParser(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            return wechaty_puppet_1.throwUnsupportedError();
        });
    }
    /**
     *
     * Friendship
     *
     */
    friendshipRawPayload(id) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.warn('PuppetPuppeteer', 'friendshipRawPayload(%s)', id);
            const rawPayload = yield this.bridge.getMessage(id);
            if (!rawPayload) {
                throw new Error('no rawPayload');
            }
            return rawPayload;
        });
    }
    friendshipRawPayloadParser(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.warn('PuppetPuppeteer', 'friendshipRawPayloadParser(%s)', rawPayload);
            switch (rawPayload.MsgType) {
                case web_schemas_1.WebMessageType.VERIFYMSG:
                    if (!rawPayload.RecommendInfo) {
                        throw new Error('no RecommendInfo');
                    }
                    const recommendInfo = rawPayload.RecommendInfo;
                    if (!recommendInfo) {
                        throw new Error('no recommendInfo');
                    }
                    const payloadReceive = {
                        contactId: recommendInfo.UserName,
                        hello: recommendInfo.Content,
                        id: rawPayload.MsgId,
                        ticket: recommendInfo.Ticket,
                        type: wechaty_puppet_1.FriendshipType.Receive,
                    };
                    return payloadReceive;
                case web_schemas_1.WebMessageType.SYS:
                    const payloadConfirm = {
                        contactId: rawPayload.FromUserName,
                        id: rawPayload.MsgId,
                        type: wechaty_puppet_1.FriendshipType.Confirm,
                    };
                    return payloadConfirm;
                default:
                    throw new Error('not supported friend request message raw payload');
            }
        });
    }
    friendshipAdd(contactId, hello) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.bridge.verifyUserRequest(contactId, hello);
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'friendshipAdd() bridge.verifyUserRequest(%s, %s) rejected: %s', contactId, hello, e.message);
                throw e;
            }
        });
    }
    friendshipAccept(friendshipId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = yield this.friendshipPayload(friendshipId);
            try {
                yield this.bridge.verifyUserOk(payload.contactId, payload.ticket);
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'bridge.verifyUserOk(%s, %s) rejected: %s', payload.contactId, payload.ticket, e.message);
                throw e;
            }
        });
    }
    /**
     * @private
     * For issue #668
     */
    waitStable() {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'readyStable()');
            let prevLength = -1;
            let ttl = 60;
            const sleepTime = 60 * 1000 / ttl;
            while (ttl-- > 0) {
                const contactIdList = yield this.contactList();
                if (prevLength === contactIdList.length) {
                    config_1.log.verbose('PuppetPuppeteer', 'readyStable() stable() READY length=%d', prevLength);
                    return;
                }
                prevLength = contactIdList.length;
                yield new Promise(r => setTimeout(r, sleepTime));
            }
            config_1.log.warn('PuppetPuppeteer', 'readyStable() TTL expired. Final length=%d', prevLength);
        });
    }
    /**
     * https://www.chatie.io:8080/api
     * location.hostname = www.chatie.io
     * location.host = www.chatie.io:8080
     * See: https://stackoverflow.com/a/11379802/1123955
     */
    hostname() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const name = yield this.bridge.hostname();
                if (!name) {
                    throw new Error('no hostname found');
                }
                return name;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'hostname() exception:%s', e);
                this.emit('error', e);
                throw e;
            }
        });
    }
    cookies() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.bridge.cookies();
        });
    }
    saveCookie() {
        return __awaiter(this, void 0, void 0, function* () {
            const cookieList = yield this.bridge.cookies();
            yield this.memory.set(config_1.MEMORY_SLOT, cookieList);
            yield this.memory.save();
        });
    }
    extToType(ext) {
        switch (ext) {
            case '.bmp':
            case '.jpeg':
            case '.jpg':
            case '.png':
                return web_schemas_1.WebMessageType.IMAGE;
            case '.gif':
                return web_schemas_1.WebMessageType.EMOTICON;
            case '.mp4':
                return web_schemas_1.WebMessageType.VIDEO;
            default:
                return web_schemas_1.WebMessageType.APP;
        }
    }
    // public async readyMedia(): Promise<this> {
    messageRawPayloadToUrl(rawPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.silly('PuppetPuppeteer', 'readyMedia()');
            // let type = MessageType.Unknown
            let url;
            try {
                switch (rawPayload.MsgType) {
                    case web_schemas_1.WebMessageType.EMOTICON:
                        // type = MessageType.Emoticon
                        url = yield this.bridge.getMsgEmoticon(rawPayload.MsgId);
                        break;
                    case web_schemas_1.WebMessageType.IMAGE:
                        // type = MessageType.Image
                        url = yield this.bridge.getMsgImg(rawPayload.MsgId);
                        break;
                    case web_schemas_1.WebMessageType.VIDEO:
                    case web_schemas_1.WebMessageType.MICROVIDEO:
                        // type = MessageType.Video
                        url = yield this.bridge.getMsgVideo(rawPayload.MsgId);
                        break;
                    case web_schemas_1.WebMessageType.VOICE:
                        // type = MessageType.Audio
                        url = yield this.bridge.getMsgVoice(rawPayload.MsgId);
                        break;
                    case web_schemas_1.WebMessageType.APP:
                        switch (rawPayload.AppMsgType) {
                            case web_schemas_1.WebAppMsgType.ATTACH:
                                if (!rawPayload.MMAppMsgDownloadUrl) {
                                    throw new Error('no MMAppMsgDownloadUrl');
                                }
                                // had set in Message
                                // type = MessageType.Attachment
                                url = rawPayload.MMAppMsgDownloadUrl;
                                break;
                            case web_schemas_1.WebAppMsgType.URL:
                            case web_schemas_1.WebAppMsgType.READER_TYPE:
                                if (!rawPayload.Url) {
                                    throw new Error('no Url');
                                }
                                // had set in Message
                                // type = MessageType.Attachment
                                url = rawPayload.Url;
                                break;
                            default:
                                const e = new Error('ready() unsupported typeApp(): ' + rawPayload.AppMsgType);
                                config_1.log.warn('PuppeteerMessage', e.message);
                                throw e;
                        }
                        break;
                    case web_schemas_1.WebMessageType.TEXT:
                        if (rawPayload.SubMsgType === web_schemas_1.WebMessageType.LOCATION) {
                            // type = MessageType.Image
                            url = yield this.bridge.getMsgPublicLinkImg(rawPayload.MsgId);
                        }
                        break;
                    default:
                        /**
                         * not a support media message, do nothing.
                         */
                        return null;
                    // return this
                }
                if (!url) {
                    // if (!this.payload.url) {
                    //   /**
                    //    * not a support media message, do nothing.
                    //    */
                    //   return this
                    // }
                    // url = this.payload.url
                    // return {
                    //   type: MessageType.Unknown,
                    // }
                    return null;
                }
            }
            catch (e) {
                config_1.log.warn('PuppetPuppeteer', 'ready() exception: %s', e.message);
                throw e;
            }
            return url;
        });
    }
    uploadMedia(file, toUserName) {
        return __awaiter(this, void 0, void 0, function* () {
            const filename = file.name;
            const ext = path_1.default.extname(filename); //  message.ext()
            // const contentType = Misc.mime(ext)
            const contentType = mime_1.default.getType(ext);
            // const contentType = message.mimeType()
            if (!contentType) {
                throw new Error('no MIME Type found on mediaMessage: ' + file.name);
            }
            let mediatype;
            switch (ext) {
                case '.bmp':
                case '.jpeg':
                case '.jpg':
                case '.png':
                case '.gif':
                    mediatype = 1 /* Image */;
                    break;
                case '.mp4':
                    mediatype = 2 /* Video */;
                    break;
                default:
                    mediatype = 4 /* Attachment */;
            }
            const buffer = yield new Promise((resolve, reject) => {
                file.pipe(new bl_1.default((err, data) => {
                    if (err)
                        reject(err);
                    else
                        resolve(data);
                }));
            });
            // Sending video files is not allowed to exceed 20MB
            // https://github.com/Chatie/webwx-app-tracker/blob/
            //  7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L1115
            const MAX_FILE_SIZE = 100 * 1024 * 1024;
            const LARGE_FILE_SIZE = 25 * 1024 * 1024;
            const MAX_VIDEO_SIZE = 20 * 1024 * 1024;
            if (mediatype === 2 /* Video */ && buffer.length > MAX_VIDEO_SIZE) {
                throw new Error(`Sending video files is not allowed to exceed ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
            }
            if (buffer.length > MAX_FILE_SIZE) {
                throw new Error(`Sending files is not allowed to exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`);
            }
            const fileMd5 = md5_1.default(buffer);
            const baseRequest = yield this.getBaseRequest();
            const passTicket = yield this.bridge.getPassticket();
            const uploadMediaUrl = yield this.bridge.getUploadMediaUrl();
            const checkUploadUrl = yield this.bridge.getCheckUploadUrl();
            const cookie = yield this.bridge.cookies();
            const first = cookie.find(c => c.name === 'webwx_data_ticket');
            const webwxDataTicket = first && first.value;
            const size = buffer.length;
            const fromUserName = this.selfId();
            const id = 'WU_FILE_' + this.fileId;
            this.fileId++;
            const hostname = yield this.bridge.hostname();
            const headers = {
                Cookie: cookie.map(c => c.name + '=' + c.value).join('; '),
                Referer: `https://${hostname}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 '
                    + '(KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
            };
            config_1.log.silly('PuppetPuppeteer', 'uploadMedia() headers:%s', JSON.stringify(headers));
            const uploadMediaRequest = {
                AESKey: '',
                BaseRequest: baseRequest,
                ClientMediaId: +new Date(),
                DataLen: size,
                FileMd5: fileMd5,
                FromUserName: fromUserName,
                MediaType: 4 /* Attachment */,
                Signature: '',
                StartPos: 0,
                ToUserName: toUserName,
                TotalLen: size,
                UploadType: 2,
            };
            const checkData = {
                BaseRequest: baseRequest,
                FileMd5: fileMd5,
                FileName: filename,
                FileSize: size,
                FileType: 7,
                FromUserName: fromUserName,
                ToUserName: toUserName,
            };
            const mediaData = {
                FileMd5: fileMd5,
                FileName: filename,
                FileSize: size,
                MMFileExt: ext,
                MediaId: '',
                ToUserName: toUserName,
            };
            // If file size > 25M, must first call checkUpload to get Signature and AESKey, otherwise it will fail to upload
            // https://github.com/Chatie/webwx-app-tracker/blob/
            //  7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L1132 #1182
            if (size > LARGE_FILE_SIZE) {
                let ret;
                try {
                    ret = yield new Promise((resolve, reject) => {
                        const r = {
                            headers,
                            json: checkData,
                            url: `https://${hostname}${checkUploadUrl}`,
                        };
                        request_1.default.post(r, (err, _ /* res */, body) => {
                            try {
                                if (err) {
                                    reject(err);
                                }
                                else {
                                    let obj = body;
                                    if (typeof body !== 'object') {
                                        config_1.log.silly('PuppetPuppeteer', 'updateMedia() typeof body = %s', typeof body);
                                        try {
                                            obj = JSON.parse(body);
                                        }
                                        catch (e) {
                                            config_1.log.error('PuppetPuppeteer', 'updateMedia() body = %s', body);
                                            config_1.log.error('PuppetPuppeteer', 'updateMedia() exception: %s', e);
                                            this.emit('error', e);
                                        }
                                    }
                                    if (typeof obj !== 'object' || obj.BaseResponse.Ret !== 0) {
                                        const errMsg = obj.BaseResponse || 'api return err';
                                        config_1.log.silly('PuppetPuppeteer', 'uploadMedia() checkUpload err:%s \nreq:%s\nret:%s', JSON.stringify(errMsg), JSON.stringify(r), body);
                                        reject(new Error('chackUpload err:' + JSON.stringify(errMsg)));
                                    }
                                    resolve({
                                        AESKey: obj.AESKey,
                                        Signature: obj.Signature,
                                    });
                                }
                            }
                            catch (e) {
                                reject(e);
                            }
                        });
                    });
                }
                catch (e) {
                    config_1.log.error('PuppetPuppeteer', 'uploadMedia() checkUpload exception: %s', e.message);
                    throw e;
                }
                if (!ret.Signature) {
                    config_1.log.error('PuppetPuppeteer', 'uploadMedia(): chackUpload failed to get Signature');
                    throw new Error('chackUpload failed to get Signature');
                }
                uploadMediaRequest.Signature = ret.Signature;
                uploadMediaRequest.AESKey = ret.AESKey;
                mediaData.Signature = ret.Signature;
            }
            else {
                delete uploadMediaRequest.Signature;
                delete uploadMediaRequest.AESKey;
            }
            config_1.log.verbose('PuppetPuppeteer', 'uploadMedia() webwx_data_ticket: %s', webwxDataTicket);
            config_1.log.verbose('PuppetPuppeteer', 'uploadMedia() pass_ticket: %s', passTicket);
            const formData = {
                filename: {
                    options: {
                        contentType,
                        filename,
                        size,
                    },
                    value: buffer,
                },
                id,
                lastModifiedDate: Date().toString(),
                mediatype,
                name: filename,
                pass_ticket: passTicket || '',
                size,
                type: contentType,
                uploadmediarequest: JSON.stringify(uploadMediaRequest),
                webwx_data_ticket: webwxDataTicket,
            };
            let mediaId;
            try {
                mediaId = yield new Promise((resolve, reject) => {
                    try {
                        request_1.default.post({
                            formData,
                            headers,
                            url: uploadMediaUrl + '?f=json',
                        }, (err, _, body) => {
                            if (err) {
                                reject(err);
                            }
                            else {
                                let obj = body;
                                if (typeof body !== 'object') {
                                    obj = JSON.parse(body);
                                }
                                resolve(obj.MediaId || '');
                            }
                        });
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'uploadMedia() uploadMedia exception: %s', e.message);
                throw new Error('uploadMedia err: ' + e.message);
            }
            if (!mediaId) {
                config_1.log.error('PuppetPuppeteer', 'uploadMedia(): upload fail');
                throw new Error('PuppetPuppeteer.uploadMedia(): upload fail');
            }
            return Object.assign(mediaData, { MediaId: mediaId });
        });
    }
    messageSendFile(receiver, file) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'messageSendFile(receiver=%s, file=%s)', JSON.stringify(receiver), file.toString());
            let destinationId;
            if (receiver.roomId) {
                destinationId = receiver.roomId;
            }
            else if (receiver.contactId) {
                destinationId = receiver.contactId;
            }
            else {
                throw new Error('PuppetPuppeteer.messageSendFile(): message with neither room nor to?');
            }
            let mediaData;
            let rawPayload = {};
            if (!rawPayload || !rawPayload.MediaId) {
                try {
                    mediaData = yield this.uploadMedia(file, destinationId);
                    rawPayload = Object.assign(rawPayload, mediaData);
                    config_1.log.silly('PuppetPuppeteer', 'Upload completed, new rawObj:%s', JSON.stringify(rawPayload));
                }
                catch (e) {
                    config_1.log.error('PuppetPuppeteer', 'sendMedia() exception: %s', e.message);
                    throw e;
                }
            }
            else {
                // To support forward file
                config_1.log.silly('PuppetPuppeteer', 'skip upload file, rawObj:%s', JSON.stringify(rawPayload));
                mediaData = {
                    FileName: rawPayload.FileName,
                    FileSize: rawPayload.FileSize,
                    MMFileExt: rawPayload.MMFileExt,
                    MediaId: rawPayload.MediaId,
                    MsgType: rawPayload.MsgType,
                    ToUserName: destinationId,
                };
                if (rawPayload.Signature) {
                    mediaData.Signature = rawPayload.Signature;
                }
            }
            // console.log('mediaData.MsgType', mediaData.MsgType)
            // console.log('rawObj.MsgType', message.rawObj && message.rawObj.MsgType)
            mediaData.MsgType = this.extToType(path_1.default.extname(file.name));
            config_1.log.silly('PuppetPuppeteer', 'sendMedia() destination: %s, mediaId: %s, MsgType; %s)', destinationId, mediaData.MediaId, mediaData.MsgType);
            let ret = false;
            try {
                ret = yield this.bridge.sendMedia(mediaData);
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'sendMedia() exception: %s', e.message);
                throw e;
            }
            if (!ret) {
                throw new Error('sendMedia fail');
            }
        });
    }
    messageSendContact(receiver, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            config_1.log.verbose('PuppetPuppeteer', 'messageSend("%s", %s)', JSON.stringify(receiver), contactId);
            throw new Error('not support');
        });
    }
    getBaseRequest() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const json = yield this.bridge.getBaseRequest();
                const obj = JSON.parse(json);
                return obj.BaseRequest;
            }
            catch (e) {
                config_1.log.error('PuppetPuppeteer', 'send() exception: %s', e.message);
                throw e;
            }
        });
    }
    unref() {
        config_1.log.verbose('PuppetPuppeteer', 'unref ()');
        super.unref();
        if (this.scanWatchdog) {
            this.scanWatchdog.unref();
        }
        // TODO: unref() the puppeteer
    }
}
PuppetPuppeteer.VERSION = config_1.VERSION;
exports.PuppetPuppeteer = PuppetPuppeteer;
exports.default = PuppetPuppeteer;
//# sourceMappingURL=puppet-puppeteer.js.map