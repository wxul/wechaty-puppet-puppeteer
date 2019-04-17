#!/usr/bin/env ts-node
"use strict";
// tslint:disable:no-console
// tslint:disable:no-var-requires
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PACKAGE_JSON = path.join(__dirname, '../package.json');
const pkg = require(PACKAGE_JSON);
pkg.publishConfig = Object.assign({ access: 'public' }, pkg.publishConfig, { tag: 'next' });
fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2));
// console.log(JSON.stringify(pkg, null, 2))
console.log('set package.json:publicConfig.tag to next.');
//# sourceMappingURL=package-publish-config-tag-next.js.map