"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isRoomId(id) {
    return /^@@/.test(id);
}
exports.isRoomId = isRoomId;
function isContactId(id) {
    return !isRoomId(id);
}
exports.isContactId = isContactId;
//# sourceMappingURL=is-type.js.map