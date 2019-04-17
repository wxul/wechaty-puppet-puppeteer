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
// tslint:disable:no-shadowed-variable
// tslint:disable:no-var-requires
// tslint:disable:only-arrow-functions
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
const blue_tape_1 = __importDefault(require("blue-tape"));
const sinon_1 = __importDefault(require("sinon"));
// const sinonTest   = require('sinon-test')(sinon, {
//   useFakeTimers: {  // https://github.com/sinonjs/lolex
//     advanceTimeDelta  : 10,
//     shouldAdvanceTime : true,
//   },
// })
// import { log }    from './config'
// log.level('silly')
const bridge_1 = require("./bridge");
const event_1 = require("./event");
const puppet_puppeteer_1 = require("./puppet-puppeteer");
class PuppetTest extends puppet_puppeteer_1.PuppetPuppeteer {
    contactRawPayload(id) {
        return super.contactRawPayload(id);
    }
    roomRawPayload(id) {
        return super.roomRawPayload(id);
    }
    messageRawPayload(id) {
        return super.messageRawPayload(id);
    }
}
// test('Puppet smoke testing', async t => {
//   const puppet  = new PuppetTest()
//   const wechaty = new WechatyTest({ puppet })
//   wechaty.initPuppetAccessory(puppet)
//   t.ok(puppet.state.off(), 'should be OFF state after instanciate')
//   puppet.state.on('pending')
//   t.ok(puppet.state.on(), 'should be ON state after set')
//   t.ok(puppet.state.pending(), 'should be pending state after set')
// })
blue_tape_1.default('login/logout events', (t) => __awaiter(this, void 0, void 0, function* () {
    const sandbox = sinon_1.default.createSandbox();
    try {
        const puppet = new PuppetTest();
        sandbox.stub(event_1.Event, 'onScan'); // block the scan event to prevent reset logined user
        sandbox.stub(bridge_1.Bridge.prototype, 'getUserName').resolves('mockedUserName');
        sandbox.stub(bridge_1.Bridge.prototype, 'contactList')
            .onFirstCall().resolves([])
            .onSecondCall().resolves(['1'])
            .resolves(['1', '2']);
        sandbox.stub(puppet, 'contactRawPayload').resolves({
            NickName: 'mockedNickName',
            UserName: 'mockedUserName',
        });
        // sandbox.stub(puppet, 'waitStable').resolves()
        yield puppet.start();
        t.pass('should be inited');
        t.is(puppet.logonoff(), false, 'should be not logined');
        const future = new Promise(r => puppet.once('login', r))
            .catch(e => t.fail(e));
        puppet.bridge.emit('login', 'TestPuppetPuppeteer');
        yield future;
        t.is(puppet.logonoff(), true, 'should be logined');
        t.ok(puppet.bridge.getUserName.called, 'bridge.getUserName should be called');
        // Puppet will not ready the contact, so the contactRawPayload might not be called at here. Huan, 2018.6
        // t.ok((puppet.contactRawPayload as any).called,  'puppet.contactRawPayload should be called')
        t.ok(bridge_1.Bridge.prototype.contactList.called, 'contactList stub should be called');
        t.is(bridge_1.Bridge.prototype.contactList.callCount, 4, 'should call stubContacList 4 times');
        const logoutPromise = new Promise((resolve) => puppet.once('logout', () => resolve('logoutFired')));
        puppet.bridge.emit('logout');
        t.is(yield logoutPromise, 'logoutFired', 'should fire logout event');
        t.is(puppet.logonoff(), false, 'should be logouted');
        yield puppet.stop();
    }
    catch (e) {
        t.fail(e);
    }
    finally {
        sandbox.restore();
    }
}));
blue_tape_1.default('restart() 3 times', (t) => __awaiter(this, void 0, void 0, function* () {
    const puppet = new puppet_puppeteer_1.PuppetPuppeteer();
    let n = 3;
    while (n--) {
        yield puppet.start();
        yield puppet.stop();
    }
    t.pass('restarted many times');
}));
//# sourceMappingURL=puppet-puppeteer.spec.js.map