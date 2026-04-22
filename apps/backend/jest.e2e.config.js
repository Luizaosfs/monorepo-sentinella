"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jest_config_1 = require("./jest.config");
const e2eConfig = {
    ...jest_config_1.default,
    testRegex: '.*\\.e2e\\.spec\\.ts$',
    testPathIgnorePatterns: [],
    testTimeout: 120_000,
    globalSetup: '<rootDir>/test/e2e/global-setup.ts',
    globalTeardown: '<rootDir>/test/e2e/global-teardown.ts',
};
exports.default = e2eConfig;
//# sourceMappingURL=jest.e2e.config.js.map