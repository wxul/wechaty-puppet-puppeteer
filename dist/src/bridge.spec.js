#!/usr/bin/env ts-node
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
// tslint:disable:no-shadowed-variable
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
const blue_tape_1 = __importDefault(require("blue-tape"));
// import sinon from 'sinon'
const puppeteer_1 = require("puppeteer");
// import { spy }    from 'sinon'
const memory_card_1 = require("memory-card");
// import {
//   log,
// }                 from './config'
// log.silly('BridgeTesting', 'import typings for Brolog')
const bridge_1 = __importDefault(require("./bridge"));
const PUPPETEER_LAUNCH_OPTIONS = {
    args: [
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--no-sandbox',
    ],
    headless: true,
};
blue_tape_1.default('PuppetPuppeteerBridge', (t) => __awaiter(this, void 0, void 0, function* () {
    const memory = new memory_card_1.MemoryCard();
    yield memory.load();
    const bridge = new bridge_1.default({ memory });
    try {
        yield bridge.start();
        yield bridge.stop();
        t.pass('Bridge instnace');
    }
    catch (e) {
        t.fail('Bridge instance: ' + e);
    }
}));
blue_tape_1.default('preHtmlToXml()', (t) => __awaiter(this, void 0, void 0, function* () {
    const BLOCKED_HTML_ZH = [
        '<pre style="word-wrap: break-word; white-space: pre-wrap;">',
        '&lt;error&gt;',
        '&lt;ret&gt;1203&lt;/ret&gt;',
        '&lt;message&gt;当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过Windows微信、Mac微信或者手机客户端微信登录。&lt;/message&gt;',
        '&lt;/error&gt;',
        '</pre>',
    ].join('');
    const BLOCKED_XML_ZH = [
        '<error>',
        '<ret>1203</ret>',
        '<message>当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过Windows微信、Mac微信或者手机客户端微信登录。</message>',
        '</error>',
    ].join('');
    const memory = new memory_card_1.MemoryCard();
    const bridge = new bridge_1.default({ memory });
    const xml = bridge.preHtmlToXml(BLOCKED_HTML_ZH);
    t.equal(xml, BLOCKED_XML_ZH, 'should parse html to xml');
}));
blue_tape_1.default('testBlockedMessage()', (t) => __awaiter(this, void 0, void 0, function* () {
    const BLOCKED_HTML_ZH = [
        '<pre style="word-wrap: break-word; white-space: pre-wrap;">',
        '&lt;error&gt;',
        '&lt;ret&gt;1203&lt;/ret&gt;',
        '&lt;message&gt;当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过手机客户端或者windows微信登录。&lt;/message&gt;',
        '&lt;/error&gt;',
        '</pre>',
    ].join('');
    const BLOCKED_XML_ZH = `
    <error>
     <ret>1203</ret>
     <message>当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。你可以通过手机客户端或者windows微信登录。</message>
    </error>
  `;
    const BLOCKED_TEXT_ZH = [
        '当前登录环境异常。为了你的帐号安全，暂时不能登录web微信。',
        '你可以通过手机客户端或者windows微信登录。',
    ].join('');
    // tslint:disable:max-line-length
    const BLOCKED_XML_EN = `
    <error>
     <ret>1203</ret>
     <message>For account security, newly registered WeChat accounts are unable to log in to Web WeChat. To use WeChat on a computer, use Windows WeChat or Mac WeChat at http://wechat.com</message>
    </error>
  `;
    const BLOCKED_TEXT_EN = [
        'For account security, newly registered WeChat accounts are unable to log in to Web WeChat.',
        ' To use WeChat on a computer, use Windows WeChat or Mac WeChat at http://wechat.com',
    ].join('');
    t.test('not blocked', (t) => __awaiter(this, void 0, void 0, function* () {
        const memory = new memory_card_1.MemoryCard();
        const bridge = new bridge_1.default({ memory });
        const msg = yield bridge.testBlockedMessage('this is not xml');
        t.equal(msg, false, 'should return false when no block message');
    }));
    t.test('html', (t) => __awaiter(this, void 0, void 0, function* () {
        const memory = new memory_card_1.MemoryCard();
        const bridge = new bridge_1.default({ memory });
        const msg = yield bridge.testBlockedMessage(BLOCKED_HTML_ZH);
        t.equal(msg, BLOCKED_TEXT_ZH, 'should get zh blocked message');
    }));
    t.test('zh', (t) => __awaiter(this, void 0, void 0, function* () {
        const memory = new memory_card_1.MemoryCard();
        const bridge = new bridge_1.default({ memory });
        const msg = yield bridge.testBlockedMessage(BLOCKED_XML_ZH);
        t.equal(msg, BLOCKED_TEXT_ZH, 'should get zh blocked message');
    }));
    blue_tape_1.default('en', (t) => __awaiter(this, void 0, void 0, function* () {
        const memory = new memory_card_1.MemoryCard();
        const bridge = new bridge_1.default({ memory });
        const msg = yield bridge.testBlockedMessage(BLOCKED_XML_EN);
        t.equal(msg, BLOCKED_TEXT_EN, 'should get en blocked message');
    }));
}));
blue_tape_1.default('clickSwitchAccount()', (t) => __awaiter(this, void 0, void 0, function* () {
    const SWITCH_ACCOUNT_HTML = `
    <div class="association show" ng-class="{show: isAssociationLogin &amp;&amp; !isBrokenNetwork}">
    <img class="img" mm-src="" alt="" src="//res.wx.qq.com/a/wx_fed/webwx/res/static/img/2KriyDK.png">
    <p ng-show="isWaitingAsConfirm" class="waiting_confirm ng-hide">Confirm login on mobile WeChat</p>
    <a href="javascript:;" ng-show="!isWaitingAsConfirm" ng-click="associationLogin()" class="button button_primary">Log in</a>
    <a href="javascript:;" ng-click="qrcodeLogin()" class="button button_default">Switch Account</a>
    </div>
  `;
    const memory = new memory_card_1.MemoryCard();
    const bridge = new bridge_1.default({ memory });
    t.test('switch account needed', (t) => __awaiter(this, void 0, void 0, function* () {
        const browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
        const page = yield browser.newPage();
        yield page.setContent(SWITCH_ACCOUNT_HTML);
        const clicked = yield bridge.clickSwitchAccount(page);
        yield page.close();
        yield browser.close();
        t.equal(clicked, true, 'should click the switch account button');
    }));
    t.test('switch account not needed', (t) => __awaiter(this, void 0, void 0, function* () {
        const browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
        const page = yield browser.newPage();
        yield page.setContent('<h1>ok</h1>');
        const clicked = yield bridge.clickSwitchAccount(page);
        yield page.close();
        yield browser.close();
        t.equal(clicked, false, 'should no button found');
    }));
}));
blue_tape_1.default('WechatyBro.ding()', (t) => __awaiter(this, void 0, void 0, function* () {
    const memory = new memory_card_1.MemoryCard(Math.random().toString(36).substr(2, 5));
    yield memory.load();
    const bridge = new bridge_1.default({
        memory,
    });
    t.ok(bridge, 'should instanciated a bridge');
    try {
        yield bridge.start();
        t.pass('should init Bridge');
        const retDing = yield bridge.evaluate(() => {
            return WechatyBro.ding();
        });
        t.is(retDing, 'dong', 'should got dong after execute WechatyBro.ding()');
        const retCode = yield bridge.proxyWechaty('loginState');
        t.is(typeof retCode, 'boolean', 'should got a boolean after call proxyWechaty(loginState)');
        yield bridge.stop();
        t.pass('b.quit()');
    }
    catch (err) {
        t.fail('exception: ' + err.message);
    }
    finally {
        yield memory.destroy();
    }
}));
//# sourceMappingURL=bridge.spec.js.map