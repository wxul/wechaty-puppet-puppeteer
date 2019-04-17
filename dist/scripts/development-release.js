#!/usr/bin/env ts-node
"use strict";
// tslint:disable:no-console
// tslint:disable:no-var-requires
Object.defineProperty(exports, "__esModule", { value: true });
const semver_1 = require("semver");
const { version } = require('../package.json');
if (semver_1.minor(version) % 2 === 0) { // production release
    console.log(`${version} is production release`);
    process.exit(1); // exit 1 for not development
}
// development release
console.log(`${version} is development release`);
process.exit(0);
//# sourceMappingURL=development-release.js.map