/** @type {import('jest').Config} */
module.exports = {
  // Handles .ts AND .tsx (JSX) out-of-the-box
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  testSequencer: undefined,

  /* Optional niceties */
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
