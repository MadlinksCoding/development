// Test runner configuration (separate from Jest config)
module.exports = {
  rootDir: process.env.ROOT_DIR || 'C:/Users/linde/Projects/Clients/Fansocial/Code/NodeApp',
  classes: [
    {
      name: 'ErrorHandler',
      src: 'src/utils/ErrorHandler.js',
      test: 'tests/jest/tests/ErrorHandler.test.js'
    },
    {
      name: 'SafeUtils',
      src: 'src/utils/SafeUtils.js',
      test: 'tests/jest/tests/SafeUtils.test.js'
    },
    {
      name: 'DateTime',
      src: 'src/utils/DateTime.js',
      test: 'tests/jest/tests/DateTime.test.js'
    },
    {
      name: 'EnvLoader',
      src: 'src/utils/EnvLoader.js',
      test: 'tests/jest/tests/EnvLoader.test.js'
    },
    {
      name: 'ConfigFileLoader',
      src: 'src/utils/ConfigFileLoader.js',
      test: 'tests/jest/tests/ConfigFileLoader.test.js'
    },
    {
      name: 'Logger',
      src: 'src/utils/Logger.js',
      test: 'tests/jest/tests/Logger.test.js'
    }
  ]
};

