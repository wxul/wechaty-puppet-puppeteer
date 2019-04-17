"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
// import {
//   PuppetScanEvent,
// }                 from 'wechaty-puppet'
const firer_1 = require("./firer");
const web_schemas_1 = require("./web-schemas");
/* tslint:disable:variable-name */
exports.Event = {
    onDing,
    onLog,
    onLogin,
    onLogout,
    onMessage,
    onScan,
    onUnload,
};
function onDing(data) {
    config_1.log.silly('PuppetPuppeteerEvent', 'onDing(%s)', data);
    this.emit('watchdog', { data });
}
function onScan(
// Do not use PuppetScanPayload at here, use { code: number, url: string } instead,
//  because this is related with Browser Hook Code:
//    wechaty-bro.js
payloadFromBrowser) {
    return __awaiter(this, void 0, void 0, function* () {
        config_1.log.verbose('PuppetPuppeteerEvent', 'onScan({code: %d, url: %s})', payloadFromBrowser.code, payloadFromBrowser.url);
        // if (this.state.off()) {
        //   log.verbose('PuppetPuppeteerEvent', 'onScan(%s) state.off()=%s, NOOP',
        //                                 payload, this.state.off())
        //   return
        // }
        this.scanPayload = {
            qrcode: payloadFromBrowser.url,
            status: payloadFromBrowser.code,
        };
        /**
         * When wx.qq.com push a new QRCode to Scan, there will be cookie updates(?)
         */
        yield this.saveCookie();
        if (this.logonoff()) {
            config_1.log.verbose('PuppetPuppeteerEvent', 'onScan() there has user when got a scan event. emit logout and set it to null');
            yield this.logout();
        }
        // feed watchDog a `scan` type of food
        const food = {
            data: payloadFromBrowser,
            type: 'scan',
        };
        this.emit('watchdog', food);
        const qrcode = payloadFromBrowser.url.replace(/\/qrcode\//, '/l/');
        const status = payloadFromBrowser.code;
        this.emit('scan', qrcode, status);
    });
}
function onLog(data) {
    config_1.log.silly('PuppetPuppeteerEvent', 'onLog(%s)', data);
}
function onLogin(note, ttl = 30) {
    return __awaiter(this, void 0, void 0, function* () {
        config_1.log.verbose('PuppetPuppeteerEvent', 'onLogin(%s, %d)', note, ttl);
        const TTL_WAIT_MILLISECONDS = 1 * 1000;
        if (ttl <= 0) {
            config_1.log.verbose('PuppetPuppeteerEvent', 'onLogin(%s) TTL expired');
            this.emit('error', new Error('onLogin() TTL expired.'));
            return;
        }
        // if (this.state.off()) {
        //   log.verbose('PuppetPuppeteerEvent', 'onLogin(%s, %d) state.off()=%s, NOOP',
        //                                 note, ttl, this.state.off())
        //   return
        // }
        if (this.logonoff()) {
            throw new Error('onLogin() user had already logined: ' + this.selfId());
            // await this.logout()
        }
        this.scanPayload = undefined;
        try {
            /**
             * save login user id to this.userId
             *
             * issue #772: this.bridge might not inited if the 'login' event fired too fast(because of auto login)
             */
            const userId = yield this.bridge.getUserName();
            if (!userId) {
                config_1.log.verbose('PuppetPuppeteerEvent', 'onLogin() browser not fully loaded(ttl=%d), retry later', ttl);
                const html = yield this.bridge.innerHTML();
                config_1.log.silly('PuppetPuppeteerEvent', 'onLogin() innerHTML: %s', html.substr(0, 500));
                setTimeout(onLogin.bind(this, note, ttl - 1), TTL_WAIT_MILLISECONDS);
                return;
            }
            config_1.log.silly('PuppetPuppeteerEvent', 'bridge.getUserName: %s', userId);
            // const user = this.Contact.load(userId)
            // await user.ready()
            config_1.log.silly('PuppetPuppeteerEvent', `onLogin() user ${userId} logined`);
            // if (this.state.on() === true) {
            yield this.saveCookie();
            // }
            // fix issue #668
            yield this.waitStable();
            yield this.login(userId);
        }
        catch (e) {
            config_1.log.error('PuppetPuppeteerEvent', 'onLogin() exception: %s', e);
            throw e;
        }
        return;
    });
}
function onLogout(data) {
    return __awaiter(this, void 0, void 0, function* () {
        config_1.log.verbose('PuppetPuppeteerEvent', 'onLogout(%s)', data);
        if (this.logonoff()) {
            yield this.logout();
        }
        else {
            // not logged-in???
            config_1.log.error('PuppetPuppeteerEvent', 'onLogout() without self-user');
        }
    });
}
function onMessage(rawPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        const firer = new firer_1.Firer(this);
        /**
         * Fire Events if match message type & content
         */
        switch (rawPayload.MsgType) {
            case web_schemas_1.WebMessageType.VERIFYMSG:
                this.emit('friendship', rawPayload.MsgId);
                // firer.checkFriendRequest(rawPayload)
                break;
            case web_schemas_1.WebMessageType.SYS:
                /**
                 * /^@@/.test() return true means it's a room
                 */
                if (/^@@/.test(rawPayload.FromUserName)) {
                    const joinResult = yield firer.checkRoomJoin(rawPayload);
                    const leaveResult = yield firer.checkRoomLeave(rawPayload);
                    const topicRestul = yield firer.checkRoomTopic(rawPayload);
                    if (!joinResult && !leaveResult && !topicRestul) {
                        config_1.log.silly('PuppetPuppeteerEvent', `checkRoomSystem message: <${rawPayload.Content}> not found`);
                    }
                }
                else {
                    yield firer.checkFriendConfirm(rawPayload);
                }
                break;
        }
        this.emit('message', rawPayload.MsgId);
    });
}
function onUnload() {
    return __awaiter(this, void 0, void 0, function* () {
        config_1.log.silly('PuppetPuppeteerEvent', 'onUnload()');
        /*
        try {
          await this.quit()
          await this.init()
        } catch (e) {
          log.error('PuppetPuppeteerEvent', 'onUnload() exception: %s', e)
          this.emit('error', e)
          throw e
        }
        */
    });
}
//# sourceMappingURL=event.js.map