import type { Config } from 'jest';

import baseConfig from './jest.config';

const e2eConfig: Config = {
  ...baseConfig,
  testRegex: '.*\\.e2e\\.spec\\.ts$',
  testPathIgnorePatterns: [],
  testTimeout: 120_000,
  globalSetup: '<rootDir>/test/e2e/global-setup.ts',
  globalTeardown: '<rootDir>/test/e2e/global-teardown.ts',
};

export default e2eConfig;
