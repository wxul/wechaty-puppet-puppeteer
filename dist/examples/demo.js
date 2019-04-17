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
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-console
const src_1 = require("../src/");
/**
 *
 * 1. Declare your Bot!
 *
 */
const puppet = new src_1.PuppetPuppeteer();
/**
 *
 * 2. Register event handlers for Bot
 *
 */
puppet
    .on('logout', onLogout)
    .on('login', onLogin)
    .on('scan', onScan)
    .on('error', onError)
    .on('message', onMessage);
/**
 *
 * 3. Start the bot!
 *
 */
puppet.start()
    .catch((e) => __awaiter(this, void 0, void 0, function* () {
    console.error('Bot start() fail:', e);
    yield puppet.stop();
    process.exit(-1);
}));
/**
 *
 * 4. You are all set. ;-]
 *
 */
/**
 *
 * 5. Define Event Handler Functions for:
 *  `scan`, `login`, `logout`, `error`, and `message`
 *
 */
function onScan(qrcode, status) {
    // Generate a QR Code online via
    // http://goqr.me/api/doc/create-qr-code/
    const qrcodeImageUrl = [
        'https://api.qrserver.com/v1/create-qr-code/?data=',
        encodeURIComponent(qrcode),
    ].join('');
    console.log(`[${status}] ${qrcodeImageUrl}\nScan QR Code above to log in: `);
}
function onLogin(contactId) {
    console.log(`${contactId} login`);
    puppet.messageSendText({ contactId, }, 'Wechaty login').catch(console.error);
}
function onLogout(contactId) {
    console.log(`${contactId} logouted`);
}
function onError(e) {
    console.error('Bot error:', e);
    /*
    if (bot.logonoff()) {
      bot.say('Wechaty error: ' + e.message).catch(console.error)
    }
    */
}
/**
 *
 * 6. The most important handler is for:
 *    dealing with Messages.
 *
 */
function onMessage(messageId) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = yield puppet.messagePayload(messageId);
        console.log(JSON.stringify(payload));
    });
}
/**
 *
 * 7. Output the Welcome Message
 *
 */
const welcome = `
Puppet Version: ${puppet.version()}

Please wait... I'm trying to login in...

`;
console.log(welcome);
//# sourceMappingURL=demo.js.map