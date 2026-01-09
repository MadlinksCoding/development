// Jest configuration - shows dots every second while running, no other output
module.exports = {
  verbose: false,
  testEnvironment: 'node',
  reporters: ['<rootDir>/jest-dot-reporter.js', 'default'],
  silent: false,
  notify: false,
  maxWorkers: 1,
  collectCoverage: false,
  testTimeout: 10000
};

