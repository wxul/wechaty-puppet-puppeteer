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
// tslint:disable:arrow-parens
// tslint:disable:no-console
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// tslint:disable:no-shadowed-variable
const blue_tape_1 = __importDefault(require("blue-tape"));
const sinon_1 = __importDefault(require("sinon"));
const puppeteer_1 = require("puppeteer");
const PUPPETEER_LAUNCH_OPTIONS = {
    args: [
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--no-sandbox',
    ],
    headless: true,
};
blue_tape_1.default('Puppeteer smoke testing', (t) => __awaiter(this, void 0, void 0, function* () {
    let browser;
    let page;
    try {
        browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
        t.ok(browser, 'Browser instnace');
        const version = yield browser.version();
        t.ok(version, 'should get version');
        page = yield browser.newPage();
        t.pass('should create newPage for browser');
        yield page.goto('https://wx.qq.com/');
        t.pass('should open wx.qq.com');
        const result = yield page.evaluate(() => 42);
        t.is(result, 42, 'should get 42');
    }
    catch (e) {
        t.fail(e && e.message || e);
    }
    finally {
        if (page) {
            yield page.close();
        }
        if (browser) {
            yield browser.close();
        }
    }
}));
blue_tape_1.default('evaluate() a function that returns a Promise', (t) => __awaiter(this, void 0, void 0, function* () {
    try {
        const browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
        const page = yield browser.newPage();
        const result = yield page.evaluate(() => Promise.resolve(42));
        t.equal(result, 42, 'should get resolved value of promise inside browser');
        yield page.close();
        yield browser.close();
    }
    catch (e) {
        t.fail(e && e.message || e);
    }
}));
blue_tape_1.default('evaluate() a file and get the returns value', (t) => __awaiter(this, void 0, void 0, function* () {
    const EXPECTED_OBJ = {
        code: 42,
        message: 'meaning of the life',
    };
    try {
        const browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
        const page = yield browser.newPage();
        const file = path_1.default.join(__dirname, 'fixtures/inject-file.js');
        const source = fs_1.default.readFileSync(file).toString();
        const result = yield page.evaluate(source);
        t.deepEqual(result, EXPECTED_OBJ, 'should inject file inside browser and return the value');
        const noWechaty = yield page.evaluate('typeof WechatyBro === "undefined"');
        t.equal(noWechaty, true, 'should no wechaty by default');
        const hasWindow = yield page.evaluate('typeof window === "object"');
        t.equal(hasWindow, true, 'should has window by default');
        yield page.close();
        yield browser.close();
    }
    catch (e) {
        t.fail(e && e.message || e);
    }
}));
blue_tape_1.default('page.on(console)', (t) => __awaiter(this, void 0, void 0, function* () {
    const EXPECTED_ARG1 = 'arg1';
    const EXPECTED_ARG2 = 2;
    // const EXPECTED_ARG3 = { arg3: 3 }
    const browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
    const page = yield browser.newPage();
    const spy = sinon_1.default.spy();
    page.on('console', spy);
    yield page.evaluate((...args) => {
        console.log.apply(console, args);
    }, EXPECTED_ARG1, EXPECTED_ARG2); // , EXPECTED_ARG3)
    // wait a while to let chrome fire the event
    yield new Promise(r => setTimeout(r, 3));
    t.ok(spy.calledOnce, 'should be called once');
    const consoleMessage = spy.firstCall.args[0];
    t.equal(consoleMessage.type(), 'log', 'should get log type');
    t.equal(consoleMessage.text(), EXPECTED_ARG1 + ' ' + EXPECTED_ARG2, 'should get console.log 1st/2nd arg');
    yield page.close();
    yield browser.close();
}));
blue_tape_1.default('page.exposeFunction()', (t) => __awaiter(this, void 0, void 0, function* () {
    const browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
    const page = yield browser.newPage();
    const spy = sinon_1.default.spy();
    yield page.exposeFunction('nodeFunc', spy);
    yield page.evaluate(`nodeFunc(42)`);
    t.ok(spy.calledOnce, 'should be called once inside browser');
    t.equal(spy.firstCall.args[0], 42, 'should be called with 42');
    yield page.close();
    yield browser.close();
}));
blue_tape_1.default('other demos', (t) => __awaiter(this, void 0, void 0, function* () {
    const EXPECTED_URL = 'https://github.com/';
    try {
        const browser = yield puppeteer_1.launch(PUPPETEER_LAUNCH_OPTIONS);
        const version = yield browser.version();
        t.ok(version, 'should get version');
        const page = yield browser.newPage();
        yield page.goto(EXPECTED_URL);
        // await page.goto('https://www.chromestatus.com/features', {waitUntil: 'networkidle'});
        // await page.waitForSelector('h3 a');
        // await page.click('input[type="submit"]');
        // not the same with the document of ConsoleMessage???
        page.on('dialog', (dialog) => __awaiter(this, void 0, void 0, function* () {
            console.log(dialog);
            console.log('dialog:', dialog.type, dialog.message());
            yield dialog.accept('ok');
        }));
        page.on('error', (e, ...args) => {
            console.error('error', e);
            console.error('error:args:', args);
        });
        page.on('pageerror', (e, ...args) => {
            console.error('pageerror', e);
            console.error('pageerror:args:', args);
        });
        page.on('load', (e, ...args) => {
            console.log('load:e:', e);
            console.log('load:args:', args);
        });
        // await page.setRequestInterception(true)
        page.on('request', (interceptedRequest) => __awaiter(this, void 0, void 0, function* () {
            if (interceptedRequest.url().endsWith('.png')
                || interceptedRequest.url().endsWith('.jpg')) {
                yield interceptedRequest.abort();
            }
            else {
                yield interceptedRequest.continue();
            }
        }));
        page.on('requestfailed', (...args) => {
            console.log('requestfailed:args:', args);
        });
        page.on('response', ( /*res, ...args*/) => {
            // console.log('response:res:', res)
            // console.log('response:args:', args)
        });
        // page.click(selector[, options])
        // await page.injectFile(path.join(__dirname, 'wechaty-bro.js'))
        const cookieList = yield page.cookies();
        t.ok(cookieList.length, 'should get cookies');
        t.ok(cookieList[0].name, 'should get cookies with name');
        const cookie = {
            domain: 'qq.com',
            expires: 1234324132,
            httpOnly: false,
            name: 'test-name',
            path: '/',
            sameSite: 'Strict',
            secure: false,
            session: true,
            size: 42,
            value: 'test-value',
        };
        yield page.setCookie(cookie);
        const result = yield page.evaluate(() => 8 * 7);
        t.equal(result, 56, 'should evaluated function for () => 8 * 7 = 56');
        t.equal(yield page.evaluate('1 + 2'), 3, 'should evaluated 1 + 2 = 3');
        const url = page.url();
        t.equal(url, EXPECTED_URL, 'should get the url right');
        // await new Promise(r => setTimeout(r, 3000))
        yield page.close();
        yield browser.close();
    }
    catch (e) {
        t.fail(e);
    }
}));
//# sourceMappingURL=puppeteer.spec.js.map