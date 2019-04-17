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
import { Cache } from 'lru-cache';
import { FileBox } from 'file-box';
import { Watchdog } from 'watchdog';
import { ContactPayload, FriendshipPayload, MessagePayload, Puppet, PuppetOptions, PuppetQrcodeScanEvent, Receiver, RoomInvitationPayload, RoomMemberPayload, RoomPayload, UrlLinkPayload } from 'wechaty-puppet';
import { Bridge } from './bridge';
import { WebContactRawPayload, WebMessageRawPayload, WebRoomRawMember, WebRoomRawPayload } from './web-schemas';
export declare type ScanFoodType = 'scan' | 'login' | 'logout';
export declare class PuppetPuppeteer extends Puppet {
    options: PuppetOptions;
    static readonly VERSION: string;
    bridge: Bridge;
    scanPayload?: PuppetQrcodeScanEvent;
    scanWatchdog: Watchdog<ScanFoodType>;
    private fileId;
    protected readonly cacheMessageRawPayload: Cache<string, WebMessageRawPayload>;
    constructor(options?: PuppetOptions);
    start(): Promise<void>;
    /**
     * Deal with SCAN events
     *
     * if web browser stay at login qrcode page long time,
     * sometimes the qrcode will not refresh, leave there expired.
     * so we need to refresh the page after a while
     */
    private initWatchdogForScan;
    stop(): Promise<void>;
    private initBridge;
    protected messageRawPayloadCache(messageId: string): undefined | WebMessageRawPayload;
    messageRawPayload(id: string): Promise<WebMessageRawPayload>;
    messageRawPayloadParser(rawPayload: WebMessageRawPayload): Promise<MessagePayload>;
    messageFile(messageId: string): Promise<FileBox>;
    messageUrl(messageId: string): Promise<UrlLinkPayload>;
    private messageRawPayloadToFile;
    messageSendUrl(to: Receiver, urlLinkPayload: UrlLinkPayload): Promise<void>;
    /**
     * TODO: Test this function if it could work...
     */
    messageForward(receiver: Receiver, messageId: string): Promise<void>;
    messageSendText(receiver: Receiver, text: string): Promise<void>;
    login(userId: string): Promise<void>;
    /**
     * logout from browser, then server will emit `logout` event
     */
    logout(): Promise<void>;
    /**
     *
     * ContactSelf
     *
     *
     */
    contactSelfQrcode(): Promise<string>;
    contactSelfName(name: string): Promise<void>;
    contactSelfSignature(signature: string): Promise<void>;
    /**
     *
     * Contact
     *
     */
    contactRawPayload(id: string): Promise<WebContactRawPayload>;
    contactRawPayloadParser(rawPayload: WebContactRawPayload): Promise<ContactPayload>;
    ding(data?: string): void;
    contactAvatar(contactId: string): Promise<FileBox>;
    contactAvatar(contactId: string, file: FileBox): Promise<void>;
    contactQrcode(contactId: string): Promise<string>;
    contactAlias(contactId: string): Promise<string>;
    contactAlias(contactId: string, alias: string | null): Promise<void>;
    contactList(): Promise<string[]>;
    /**
     *
     * Room
     *
     */
    roomRawPayload(id: string): Promise<WebRoomRawPayload>;
    roomRawPayloadParser(rawPayload: WebRoomRawPayload): Promise<RoomPayload>;
    roomList(): Promise<string[]>;
    roomDel(roomId: string, contactId: string): Promise<void>;
    roomAvatar(roomId: string): Promise<FileBox>;
    roomAdd(roomId: string, contactId: string): Promise<void>;
    roomTopic(roomId: string): Promise<string>;
    roomTopic(roomId: string, topic: string): Promise<void>;
    roomCreate(contactIdList: string[], topic: string): Promise<string>;
    roomAnnounce(roomId: string): Promise<string>;
    roomAnnounce(roomId: string, text: string): Promise<void>;
    roomQuit(roomId: string): Promise<void>;
    roomQrcode(roomId: string): Promise<string>;
    roomMemberList(roomId: string): Promise<string[]>;
    roomMemberRawPayload(roomId: string, contactId: string): Promise<WebRoomRawMember>;
    roomMemberRawPayloadParser(rawPayload: WebRoomRawMember): Promise<RoomMemberPayload>;
    /**
     *
     * Room Invitation
     *
     */
    roomInvitationAccept(roomInvitationId: string): Promise<void>;
    roomInvitationRawPayload(roomInvitationId: string): Promise<any>;
    roomInvitationRawPayloadParser(rawPayload: any): Promise<RoomInvitationPayload>;
    /**
     *
     * Friendship
     *
     */
    friendshipRawPayload(id: string): Promise<WebMessageRawPayload>;
    friendshipRawPayloadParser(rawPayload: WebMessageRawPayload): Promise<FriendshipPayload>;
    friendshipAdd(contactId: string, hello: string): Promise<void>;
    friendshipAccept(friendshipId: string): Promise<void>;
    /**
     * @private
     * For issue #668
     */
    waitStable(): Promise<void>;
    /**
     * https://www.chatie.io:8080/api
     * location.hostname = www.chatie.io
     * location.host = www.chatie.io:8080
     * See: https://stackoverflow.com/a/11379802/1123955
     */
    private hostname;
    private cookies;
    saveCookie(): Promise<void>;
    private extToType;
    private messageRawPayloadToUrl;
    private uploadMedia;
    messageSendFile(receiver: Receiver, file: FileBox): Promise<void>;
    messageSendContact(receiver: Receiver, contactId: string): Promise<void>;
    private getBaseRequest;
    unref(): void;
}
export default PuppetPuppeteer;
