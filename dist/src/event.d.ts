import { PuppetPuppeteer } from './puppet-puppeteer';
import { WebMessageRawPayload } from './web-schemas';
export declare const Event: {
    onDing: typeof onDing;
    onLog: typeof onLog;
    onLogin: typeof onLogin;
    onLogout: typeof onLogout;
    onMessage: typeof onMessage;
    onScan: typeof onScan;
    onUnload: typeof onUnload;
};
declare function onDing(this: PuppetPuppeteer, data: any): void;
declare function onScan(this: PuppetPuppeteer, payloadFromBrowser: {
    code: number;
    url: string;
}): Promise<void>;
declare function onLog(data: any): void;
declare function onLogin(this: PuppetPuppeteer, note: string, ttl?: number): Promise<void>;
declare function onLogout(this: PuppetPuppeteer, data: any): Promise<void>;
declare function onMessage(this: PuppetPuppeteer, rawPayload: WebMessageRawPayload): Promise<void>;
declare function onUnload(this: PuppetPuppeteer): Promise<void>;
export {};
