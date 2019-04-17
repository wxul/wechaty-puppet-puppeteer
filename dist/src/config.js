"use strict";
// tslint:disable:no-reference
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
/// <reference path="./typings.d.ts" />
const promiseRetry = require("promise-retry");
const brolog_1 = require("brolog");
exports.log = 
// Brolog,
brolog_1.log;
const file_box_1 = require("file-box");
const qr_image_1 = __importDefault(require("qr-image"));
// export const log = new Brolog()
function retry(retryableFn) {
    return __awaiter(this, void 0, void 0, function* () {
        /**
         * 60 seconds: (to be confirmed)
         *  factor: 3
         *  minTimeout: 10
         *  maxTimeout: 20 * 1000
         *  retries: 9
         */
        const factor = 3;
        const minTimeout = 10;
        const maxTimeout = 20 * 1000;
        const retries = 9;
        // const unref      = true
        const retryOptions = {
            factor,
            maxTimeout,
            minTimeout,
            retries,
        };
        return promiseRetry(retryOptions, retryableFn);
    });
}
exports.retry = retry;
function envHead() {
    const KEY = 'WECHATY_PUPPET_PUPPETEER_HEAD';
    return KEY in process.env
        ? !!process.env[KEY]
        : false;
}
exports.envHead = envHead;
function qrCodeForChatie() {
    const CHATIE_OFFICIAL_ACCOUNT_QRCODE = 'http://weixin.qq.com/r/qymXj7DEO_1ErfTs93y5';
    const name = 'qrcode-for-chatie.png';
    const type = 'png';
    const qrStream = qr_image_1.default.image(CHATIE_OFFICIAL_ACCOUNT_QRCODE, { type });
    return file_box_1.FileBox.fromStream(qrStream, name);
}
exports.qrCodeForChatie = qrCodeForChatie;
exports.MEMORY_SLOT = 'PUPPET_PUPPETEER';
/**
 * VERSION
 */
const read_pkg_up_1 = __importDefault(require("read-pkg-up"));
const pkg = read_pkg_up_1.default.sync({ cwd: __dirname }).pkg;
exports.VERSION = pkg.version;
//# sourceMappingURL=config.js.map