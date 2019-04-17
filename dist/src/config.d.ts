/// <reference path="../../src/typings.d.ts" />
import { log } from 'brolog';
import { FileBox } from 'file-box';
export declare function retry<T>(retryableFn: (retry: (error: Error) => never, attempt: number) => Promise<T>): Promise<T>;
export declare function envHead(): boolean;
export declare function qrCodeForChatie(): FileBox;
export declare const MEMORY_SLOT = "PUPPET_PUPPETEER";
export declare const VERSION: string;
export { log, };
