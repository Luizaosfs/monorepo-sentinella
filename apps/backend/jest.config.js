"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    setupFilesAfterEnv: ['<rootDir>/src/test/jest-setup-env.ts'],
    testRegex: '.*\\.spec\\.ts$',
    transform: { '^.+\\.(t|j)s$': 'ts-jest' },
    collectCoverageFrom: ['src/**/*.(t|j)s', '!src/**/*.module.ts', '!src/main.ts'],
    coverageDirectory: './coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@test/(.*)$': '<rootDir>/src/test/$1',
    },
};
exports.default = config;
//# sourceMappingURL=jest.config.js.map