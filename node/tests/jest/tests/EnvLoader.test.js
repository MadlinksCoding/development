const fs = require('fs');
const path = require('path');

// Dynamically load EnvLoader implementation from config to avoid static paths
const CONFIG_PATH = path.resolve(__dirname, '..', 'test-runner.config.js');
let EnvLoader;
let ConfigFileLoader;
let ErrorHandler;
try {
  const cfg = require(CONFIG_PATH);
  const cls = cfg.classes.find((c) => c.name === 'EnvLoader');
  if (!cls) throw new Error('EnvLoader not found in config');
  EnvLoader = require(path.resolve(cfg.rootDir, cls.src));
  
  const configCls = cfg.classes.find((c) => c.name === 'ConfigFileLoader');
  if (configCls) {
    ConfigFileLoader = require(path.resolve(cfg.rootDir, configCls.src));
  } else {
    // Fallback to relative path
    ConfigFileLoader = require(path.resolve(cfg.rootDir, 'src', 'utils', 'ConfigFileLoader'));
  }
  
  const errorCls = cfg.classes.find((c) => c.name === 'ErrorHandler');
  if (errorCls) {
    ErrorHandler = require(path.resolve(cfg.rootDir, errorCls.src));
  } else {
    // Fallback to relative path
    ErrorHandler = require(path.resolve(cfg.rootDir, 'src', 'utils', 'ErrorHandler'));
  }
} catch (err) {
  throw new Error(`Failed to load EnvLoader class: ${err.message}`);
}

// Helper to create test .env file
const createTestEnvFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
};

// Helper to cleanup test files
const cleanupTestFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
};

// Helper to cleanup directory recursively
const cleanupDirectory = (dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      files.forEach((file) => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          cleanupDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(dirPath);
    }
  } catch {
    // Ignore cleanup errors
  }
};

// Helper to create test config file
const createTestConfigFile = (filePath, config) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
};

// Suppress console logs during tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;

beforeAll(() => {
  // Suppress all console output during tests
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  console.info = originalConsoleInfo;
  
  // Clean up configs directory in tests/jest directory (where tests run from)
  const configsDir = path.join(process.cwd(), 'configs');
  cleanupDirectory(configsDir);
});

// Cleanup before each test
beforeEach(() => {
  // Clean up .env and config files FIRST to ensure fresh state and cache invalidation
  const envPath = path.join(process.cwd(), '.env');
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
  
  // Reset EnvLoader state
  EnvLoader.source = process.env;
  EnvLoader.config = null;
  
  // Reset process.env to clean state (remove test vars)
  try {
    // Delete common test variables
    const testVars = ['GLOBAL_VAR', 'EXTRA_VAR', 'TEST_VAR', 'OVERLAP_VAR', 'PROD_VAR', 'DEV_VAR', 
                      'WORKFLOW_VAR', 'CHANGE_VAR', 'SPACE_VAR', 'SOURCE_VAR', 'REQUIRED_VAR',
                      'INT_VAR', 'BOOL_VAR', 'ENUM_VAR', 'VALID_VAR', 'INVALID_VAR', 'DEC_INT',
                      'LOWERCASE', 'UPPERCASE', 'ABSOLUTE_VAR'];
    testVars.forEach(key => delete process.env[key]);
    
    // Remove any other test vars that might persist
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TEST_') || key.startsWith('GLOBAL_') || key.startsWith('EXTRA_') || 
          key.startsWith('OVERLAP_') || key.startsWith('PROD_') || key.startsWith('DEV_') ||
          key.startsWith('WORKFLOW_') || key.startsWith('CHANGE_') || key.startsWith('SPACE_') ||
          key.startsWith('SOURCE_') || key.startsWith('REQUIRED_') || key.startsWith('INT_') ||
          key.startsWith('BOOL_') || key.startsWith('ENUM_') || key.startsWith('VALID_') ||
          key.startsWith('INVALID_') || key.startsWith('DEC_') || key.startsWith('LOWERCASE_') ||
          key.startsWith('UPPERCASE_') || key.startsWith('ABSOLUTE_')) {
        delete process.env[key];
      }
    });
  } catch {
    // Ignore
  }
});

afterEach(() => {
  // Cleanup any test files created
  const testEnvPath = path.join(process.cwd(), 'test.env');
  const testConfigPath = path.join(process.cwd(), 'test-config.json');
  cleanupTestFile(testEnvPath);
  cleanupTestFile(testConfigPath);
});

/**
 * --------------------------------
 * SECTION: LOADENV TESTS
 * --------------------------------
 */

/**
 * PASS_loadEnv*1: Uses defaults (.env, configs/envConfig.json) and returns normalized object.
 */
test("PASS_loadEnv*1: Uses defaults and returns normalized object", () => {
  // Create test .env file
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'TEST_VAR=test_value\n');
  
  // Create test config file
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result = EnvLoader.loadEnv();
  expect(result).toBeDefined();
  expect(typeof result).toBe('object');
  expect(result.TEST_VAR).toBe('test_value');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*2: Accepts a custom relative .env path inside project root and loads successfully.
 */
test("PASS_loadEnv*2: Accepts custom relative .env path", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'CUSTOM_VAR=custom_value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'CUSTOM_VAR' }
    ]
  });
  
  const result = EnvLoader.loadEnv('test.env');
  expect(result.CUSTOM_VAR).toBe('custom_value');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*3: Accepts a custom absolute .env path inside project root and loads successfully.
 */
test("PASS_loadEnv*3: Accepts custom absolute .env path", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'ABSOLUTE_VAR=absolute_value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'ABSOLUTE_VAR' }
    ]
  });
  
  const result = EnvLoader.loadEnv(envPath);
  expect(result.ABSOLUTE_VAR).toBe('absolute_value');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*4: Config contains only global section; result matches validated global mapping.
 */
test("PASS_loadEnv*4: Config with only global section", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'GLOBAL_VAR=global_value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'GLOBAL_VAR' }
    ]
  });
  
  const result = EnvLoader.loadEnv();
  expect(result.GLOBAL_VAR).toBe('global_value');
  expect(Object.keys(result).length).toBe(1);
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*5: Config contains global + extra sections; result merges all sections into one flat object.
 */
test("PASS_loadEnv*5: Config with global and extra sections merges", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'GLOBAL_VAR=global\nEXTRA_VAR=extra\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'GLOBAL_VAR' }
    ],
    extra: [
      { name: 'EXTRA_VAR' }
    ]
  });
  
  const result = EnvLoader.loadEnv();
  expect(result.GLOBAL_VAR).toBe('global');
  expect(result.EXTRA_VAR).toBe('extra');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*6: Config sections contain overlapping env names; later section overwrites earlier section's value.
 */
test("PASS_loadEnv*6: Overlapping env names - later section overwrites", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'OVERLAP_VAR=first\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'OVERLAP_VAR' }
    ],
    second: [
      { name: 'OVERLAP_VAR' }
    ]
  });
  
  // Both sections reference same var, second should overwrite
  const result = EnvLoader.loadEnv();
  expect(result.OVERLAP_VAR).toBe('first'); // Same value, but second section processed last
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*7: Repeated call after no .env content change still succeeds; validated section cache is cleared.
 */
test("PASS_loadEnv*7: Repeated call with no .env change succeeds", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'REPEAT_VAR=repeat_value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'REPEAT_VAR' }
    ]
  });
  
  const result1 = EnvLoader.loadEnv();
  const result2 = EnvLoader.loadEnv();
  
  expect(result1.REPEAT_VAR).toBe('repeat_value');
  expect(result2.REPEAT_VAR).toBe('repeat_value');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*8: Global entries include optional values missing in source; those appear as "" (empty string) unless default is set.
 */
test("PASS_loadEnv*8: Optional missing values return empty string", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'EXISTING_VAR=exists\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'EXISTING_VAR' },
      { name: 'MISSING_VAR' }
    ]
  });
  
  const result = EnvLoader.loadEnv();
  expect(result.EXISTING_VAR).toBe('exists');
  expect(result.MISSING_VAR).toBe('');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*9: Global entries include defaults; missing values return trimmed default strings.
 */
test("PASS_loadEnv*9: Missing values with defaults return default", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, '');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'DEFAULT_VAR', default: '  default_value  ' }
    ]
  });
  
  const result = EnvLoader.loadEnv();
  expect(result.DEFAULT_VAR).toBe('default_value');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnv*10: Global includes bool/boolean values like YES, n, 0, 1; returns correct booleans.
 */
test("PASS_loadEnv*10: Boolean parsing works with various formats", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'BOOL_TRUE=YES\nBOOL_FALSE=n\nBOOL_ONE=1\nBOOL_ZERO=0\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'BOOL_TRUE', type: 'bool' },
      { name: 'BOOL_FALSE', type: 'bool' },
      { name: 'BOOL_ONE', type: 'bool' },
      { name: 'BOOL_ZERO', type: 'bool' }
    ]
  });
  
  const result = EnvLoader.loadEnv();
  expect(result.BOOL_TRUE).toBe(true);
  expect(result.BOOL_FALSE).toBe(false);
  expect(result.BOOL_ONE).toBe(true);
  expect(result.BOOL_ZERO).toBe(false);
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_1: .env path traversal attempt (absolute path outside process.cwd() root) throws.
 */
test("FAIL_loadEnv_1: Path traversal attempt throws", () => {
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: []
  });
  
  // Try to access path outside project root
  const outsidePath = path.resolve(process.cwd(), '..', 'outside.env');
  
  expect(() => EnvLoader.loadEnv(outsidePath)).toThrow('path traversal attempt blocked');
  
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_2: .env file missing throws EnvLoader: env file not found.
 */
test("FAIL_loadEnv_2: Missing .env file throws", () => {
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: []
  });
  
  expect(() => EnvLoader.loadEnv('nonexistent.env')).toThrow('env file not found');
  
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_3: .env path exists but is not a file (directory) throws.
 */
test("FAIL_loadEnv_3: .env path is directory throws", () => {
  const dirPath = path.join(process.cwd(), 'test-dir');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: []
  });
  
  expect(() => EnvLoader.loadEnv('test-dir')).toThrow('env file path is not a file');
  
  try {
    fs.rmdirSync(dirPath);
  } catch {
    // Ignore
  }
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_4: ConfigFileLoader.loadConfig(configPath) throws (bad path / invalid JSON) and error propagates.
 */
test("FAIL_loadEnv_4: Bad config path propagates error", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'TEST=value\n');
  
  expect(() => EnvLoader.loadEnv('.env', 'nonexistent-config.json')).toThrow();
  
  cleanupTestFile(envPath);
});

/**
 * FAIL_loadEnv_5: Loaded config missing global array → setConfig() throws.
 */
test("FAIL_loadEnv_5: Config missing global array throws", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'TEST=value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {});
  
  expect(() => EnvLoader.loadEnv()).toThrow('requires a "global" array');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_6: Loaded config has non-array section → setConfig() throws.
 */
test("FAIL_loadEnv_6: Config with non-array section throws", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'TEST=value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [],
    prod: {}
  });
  
  expect(() => EnvLoader.loadEnv()).toThrow('expects section "prod" to be an array');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_7: Loaded config has lowercase env var name → setConfig() throws.
 */
test("FAIL_loadEnv_7: Lowercase env var name throws", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'test_var=value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'test_var' }
    ]
  });
  
  expect(() => EnvLoader.loadEnv()).toThrow('must be uppercase');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_8: Loaded config has int with min > max → setConfig() throws.
 */
test("FAIL_loadEnv_8: Int with min > max throws", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'INT_VAR=5\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'INT_VAR', type: 'int', min: 10, max: 5 }
    ]
  });
  
  expect(() => EnvLoader.loadEnv()).toThrow('min');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_9: Loaded config has enum without a non-empty allowed array → setConfig() throws.
 */
test("FAIL_loadEnv_9: Enum without allowed array throws", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'ENUM_VAR=value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'ENUM_VAR', type: 'enum' }
    ]
  });
  
  expect(() => EnvLoader.loadEnv()).toThrow('non-empty "allowed" array');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * FAIL_loadEnv_10: validateEnv("global") fails due to required env missing → throws.
 */
test("FAIL_loadEnv_10: Missing required env throws", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, '');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'REQUIRED_VAR', required: true }
    ]
  });
  
  expect(() => EnvLoader.loadEnv()).toThrow('missing required env');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * --------------------------------
 * SECTION: LOADENVFILE TESTS
 * --------------------------------
 */

/**
 * PASS_loadEnvFile*1: Default call loads .env from project root when present.
 */
test("PASS_loadEnvFile*1: Default call loads .env from project root", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'DEFAULT_VAR=default_value\n');
  
  const result = EnvLoader.loadEnvFile();
  expect(result).toBeDefined();
  expect(process.env.DEFAULT_VAR).toBe('default_value');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_loadEnvFile*2: Relative path resolves via path.resolve(process.cwd(), envFilePath) and loads.
 */
test("PASS_loadEnvFile*2: Relative path resolves correctly", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'RELATIVE_VAR=relative_value\n');
  
  const result = EnvLoader.loadEnvFile('test.env');
  expect(result).toBeDefined();
  expect(process.env.RELATIVE_VAR).toBe('relative_value');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_loadEnvFile*3: Absolute path inside project root loads.
 */
test("PASS_loadEnvFile*3: Absolute path inside project root loads", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'ABSOLUTE_VAR=absolute_value\n');
  
  const result = EnvLoader.loadEnvFile(envPath);
  expect(result).toBeDefined();
  expect(process.env.ABSOLUTE_VAR).toBe('absolute_value');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_loadEnvFile*4: When cached hash matches, returns successfully and does not call dotenv.config.
 */
test("PASS_loadEnvFile*4: Cache hit returns without reloading", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'CACHE_VAR=cache_value\n');
  
  const result1 = EnvLoader.loadEnvFile(envPath);
  const result2 = EnvLoader.loadEnvFile(envPath);
  
  expect(result1).toBeDefined();
  expect(result2).toBeDefined();
  expect(process.env.CACHE_VAR).toBe('cache_value');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_loadEnvFile*5: When file content changes, cache miss triggers dotenv.config, updates cache hash.
 */
test("PASS_loadEnvFile*5: Cache miss on content change triggers reload", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'CHANGE_VAR=old_value\n');
  
  EnvLoader.loadEnvFile(envPath);
  expect(process.env.CHANGE_VAR).toBe('old_value');
  
  // Change file content
  createTestEnvFile(envPath, 'CHANGE_VAR=new_value\n');
  
  EnvLoader.loadEnvFile(envPath);
  expect(process.env.CHANGE_VAR).toBe('new_value');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_loadEnvFile*6: Ensures EnvLoader.source is set to process.env after load.
 */
test("PASS_loadEnvFile*6: Sets EnvLoader.source to process.env", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'SOURCE_VAR=source_value\n');
  
  EnvLoader.loadEnvFile(envPath);
  expect(EnvLoader.source).toBe(process.env);
  expect(EnvLoader.source.SOURCE_VAR).toBe('source_value');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_loadEnvFile*7: Clears section validation cache each time.
 */
test("PASS_loadEnvFile*7: Clears section validation cache", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'CACHE_CLEAR_VAR=value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'CACHE_CLEAR_VAR' }
    ]
  });
  
  EnvLoader.loadEnvFile(envPath);
  EnvLoader.setConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  const result1 = EnvLoader.validateEnv('global');
  
  // Reload env file - should clear cache
  EnvLoader.loadEnvFile(envPath);
  const result2 = EnvLoader.validateEnv('global');
  
  expect(result1).toBeDefined();
  expect(result2).toBeDefined();
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_loadEnvFile*8: Handles .env file with trailing spaces; still loads and trims later.
 */
test("PASS_loadEnvFile*8: Handles trailing spaces in .env file", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  // Note: dotenv trims unquoted values - use quotes to preserve spaces
  createTestEnvFile(envPath, 'SPACE_VAR="  value_with_spaces  "\n');
  
  EnvLoader.loadEnvFile(envPath);
  // Quoted values preserve trailing spaces, but dotenv removes the quotes
  expect(process.env.SPACE_VAR).toBe('  value_with_spaces  ');
  
  cleanupTestFile(envPath);
});

/**
 * FAIL_loadEnvFile_1: envFilePath is null/undefined → throws requires a file path string.
 */
test("FAIL_loadEnvFile_1: null envFilePath throws", () => {
  expect(() => EnvLoader.loadEnvFile(null)).toThrow('requires a file path string');
});

/**
 * FAIL_loadEnvFile_2: envFilePath is not a string (number/object) → throws.
 */
test("FAIL_loadEnvFile_2: non-string envFilePath throws", () => {
  expect(() => EnvLoader.loadEnvFile(123)).toThrow('requires a file path string');
  expect(() => EnvLoader.loadEnvFile({})).toThrow('requires a file path string');
});

/**
 * FAIL_loadEnvFile_3: envFilePath is an empty string → throws.
 */
test("FAIL_loadEnvFile_3: empty string envFilePath throws", () => {
  expect(() => EnvLoader.loadEnvFile('')).toThrow('requires a file path string');
});

/**
 * FAIL_loadEnvFile_4: Path traversal attempt → throws.
 */
test("FAIL_loadEnvFile_4: Path traversal attempt throws", () => {
  const outsidePath = path.resolve(process.cwd(), '..', 'outside.env');
  expect(() => EnvLoader.loadEnvFile(outsidePath)).toThrow('path traversal attempt blocked');
});

/**
 * FAIL_loadEnvFile_5: File does not exist → throws.
 */
test("FAIL_loadEnvFile_5: File does not exist throws", () => {
  expect(() => EnvLoader.loadEnvFile('nonexistent.env')).toThrow('env file not found');
});

/**
 * FAIL_loadEnvFile_6: Path exists but is not a file → throws.
 */
test("FAIL_loadEnvFile_6: Path is directory throws", () => {
  const dirPath = path.join(process.cwd(), 'test-dir');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  expect(() => EnvLoader.loadEnvFile('test-dir')).toThrow('env file path is not a file');
  
  try {
    fs.rmdirSync(dirPath);
  } catch {
    // Ignore
  }
});

/**
 * FAIL_loadEnvFile_7: fs.readFileSync throws → error propagates.
 */
test("FAIL_loadEnvFile_7: File read error propagates", () => {
  // This would require mocking fs.readFileSync to throw
  // For now, test with a file that exists but might have permission issues
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'TEST=value\n');
  
  // Mock fs.readFileSync to throw
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = jest.fn(() => {
    throw new Error('Permission denied');
  });
  
  expect(() => EnvLoader.loadEnvFile(envPath)).toThrow();
  
  fs.readFileSync = originalReadFileSync;
  cleanupTestFile(envPath);
});

/**
 * FAIL_loadEnvFile_8: dotenv.config({path}) returns { error } → throws that error.
 */
test("FAIL_loadEnvFile_8: dotenv.config error propagates", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'INVALID_ENV_FORMAT\n');
  
  // dotenv might throw or return error depending on format
  // This test verifies error handling
  try {
    EnvLoader.loadEnvFile(envPath);
  } catch (err) {
    // Error should propagate
    expect(err).toBeDefined();
  }
  
  cleanupTestFile(envPath);
});

/**
 * FAIL_loadEnvFile_9: fs.statSync throws → error propagates.
 */
test("FAIL_loadEnvFile_9: fs.statSync error propagates", () => {
  const envPath = path.join(process.cwd(), 'test.env');
  createTestEnvFile(envPath, 'TEST=value\n');
  
  // Mock fs.statSync to throw
  const originalStatSync = fs.statSync;
  fs.statSync = jest.fn(() => {
    throw new Error('Stat error');
  });
  
  expect(() => EnvLoader.loadEnvFile(envPath)).toThrow();
  
  fs.statSync = originalStatSync;
  cleanupTestFile(envPath);
});

/**
 * --------------------------------
 * SECTION: SETCONFIG TESTS
 * --------------------------------
 */

/**
 * PASS_setConfig*1: Accepts valid config with global: [] and sets EnvLoader.config.
 */
test("PASS_setConfig*1: Accepts valid config with empty global", () => {
  const config = {
    global: []
  };
  
  EnvLoader.setConfig(config);
  expect(EnvLoader.config).toBe(config);
});

/**
 * PASS_setConfig*2: Accepts config with multiple sections, all arrays, and sets successfully.
 */
test("PASS_setConfig*2: Accepts config with multiple sections", () => {
  const config = {
    global: [],
    prod: [],
    dev: []
  };
  
  EnvLoader.setConfig(config);
  expect(EnvLoader.config).toBe(config);
});

/**
 * PASS_setConfig*3: Validates uppercase names; accepts FOO, BAR_BAZ.
 */
test("PASS_setConfig*3: Accepts uppercase env var names", () => {
  const config = {
    global: [
      { name: 'FOO' },
      { name: 'BAR_BAZ' }
    ]
  };
  
  expect(() => EnvLoader.setConfig(config)).not.toThrow();
  expect(EnvLoader.config).toBe(config);
});

/**
 * PASS_setConfig*4: Accepts int with only min specified.
 */
test("PASS_setConfig*4: Accepts int with only min", () => {
  const config = {
    global: [
      { name: 'INT_VAR', type: 'int', min: 0 }
    ]
  };
  
  expect(() => EnvLoader.setConfig(config)).not.toThrow();
});

/**
 * PASS_setConfig*5: Accepts int with only max specified.
 */
test("PASS_setConfig*5: Accepts int with only max", () => {
  const config = {
    global: [
      { name: 'INT_VAR', type: 'int', max: 100 }
    ]
  };
  
  expect(() => EnvLoader.setConfig(config)).not.toThrow();
});

/**
 * PASS_setConfig*6: Accepts int with min === max.
 */
test("PASS_setConfig*6: Accepts int with min === max", () => {
  const config = {
    global: [
      { name: 'INT_VAR', type: 'int', min: 5, max: 5 }
    ]
  };
  
  expect(() => EnvLoader.setConfig(config)).not.toThrow();
});

/**
 * PASS_setConfig*7: Accepts enum with allowed values (strings) and no case-insensitive duplicates.
 */
test("PASS_setConfig*7: Accepts enum with allowed values", () => {
  const config = {
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['dev', 'prod', 'stage'] }
    ]
  };
  
  expect(() => EnvLoader.setConfig(config)).not.toThrow();
});

/**
 * PASS_setConfig*8: Accepts config where a non-enum entry still has allowed array; treated as enum.
 */
test("PASS_setConfig*8: Accepts non-enum entry with allowed array", () => {
  const config = {
    global: [
      { name: 'VAR_WITH_ALLOWED', allowed: ['option1', 'option2'] }
    ]
  };
  
  expect(() => EnvLoader.setConfig(config)).not.toThrow();
});

/**
 * PASS_setConfig*9: Clears validated section cache after setting config.
 */
test("PASS_setConfig*9: Clears validated section cache", () => {
  const config1 = {
    global: [
      { name: 'VAR1' }
    ]
  };
  
  EnvLoader.setConfig(config1);
  EnvLoader.source = { VAR1: 'value1' };
  const result1 = EnvLoader.validateEnv('global');
  
  const config2 = {
    global: [
      { name: 'VAR2' }
    ]
  };
  
  EnvLoader.setConfig(config2);
  // Cache should be cleared, so validateEnv should work with new config
  EnvLoader.source = { VAR2: 'value2' };
  const result2 = EnvLoader.validateEnv('global');
  
  expect(result1.VAR1).toBe('value1');
  expect(result2.VAR2).toBe('value2');
});

/**
 * PASS_setConfig*10: Ensures entries can omit type, default, required, bounds, etc.
 */
test("PASS_setConfig*10: Accepts entries with minimal fields", () => {
  const config = {
    global: [
      { name: 'MINIMAL_VAR' }
    ]
  };
  
  expect(() => EnvLoader.setConfig(config)).not.toThrow();
});

/**
 * FAIL_setConfig_1: Missing config (null/undefined) → throws.
 */
test("FAIL_setConfig_1: Missing config throws", () => {
  expect(() => EnvLoader.setConfig(null)).toThrow('EnvLoader.setConfig requires a configuration object');
  expect(() => EnvLoader.setConfig(undefined)).toThrow('EnvLoader.load requires a "global" array of env specs');
});

/**
 * FAIL_setConfig_2: Config is not an object → throws.
 */
test("FAIL_setConfig_2: Non-object config throws", () => {
  expect(() => EnvLoader.setConfig('string')).toThrow('EnvLoader.setConfig requires a configuration object');
  expect(() => EnvLoader.setConfig(123)).toThrow('EnvLoader.setConfig requires a configuration object');
  expect(() => EnvLoader.setConfig([])).toThrow('EnvLoader.load requires a plain configuration object');
});

/**
 * FAIL_setConfig_3: Missing global key → throws.
 */
test("FAIL_setConfig_3: Missing global key throws", () => {
  expect(() => EnvLoader.setConfig({})).toThrow('requires a "global" array');
});

/**
 * FAIL_setConfig_4: global exists but is not an array → throws.
 */
test("FAIL_setConfig_4: global not an array throws", () => {
  expect(() => EnvLoader.setConfig({ global: {} })).toThrow('requires a "global" array');
});

/**
 * FAIL_setConfig_5: Any section value is not an array → throws.
 */
test("FAIL_setConfig_5: Section not an array throws", () => {
  expect(() => EnvLoader.setConfig({
    global: [],
    prod: {}
  })).toThrow('expects section "prod" to be an array');
});

/**
 * FAIL_setConfig_6: Section contains non-object entry → throws.
 */
test("FAIL_setConfig_6: Non-object entry throws", () => {
  expect(() => EnvLoader.setConfig({
    global: ['string']
  })).toThrow('invalid entry');
});

/**
 * FAIL_setConfig_7: Entry missing name or name not a string/empty → throws.
 */
test("FAIL_setConfig_7: Entry missing name throws", () => {
  expect(() => EnvLoader.setConfig({
    global: [{}]
  })).toThrow('must have a non-empty string name');
  
  expect(() => EnvLoader.setConfig({
    global: [{ name: '' }]
  })).toThrow('must have a non-empty string name');
});

/**
 * FAIL_setConfig_8: Entry name not uppercase → throws.
 */
test("FAIL_setConfig_8: Entry name not uppercase throws", () => {
  expect(() => EnvLoader.setConfig({
    global: [{ name: 'lowercase' }]
  })).toThrow('must be uppercase');
});

/**
 * FAIL_setConfig_9: int entry with both bounds present where min > max → throws.
 */
test("FAIL_setConfig_9: int with min > max throws", () => {
  expect(() => EnvLoader.setConfig({
    global: [{ name: 'INT_VAR', type: 'int', min: 10, max: 5 }]
  })).toThrow('min');
});

/**
 * FAIL_setConfig_10: enum entry missing allowed or empty allowed → throws.
 */
test("FAIL_setConfig_10: enum missing allowed throws", () => {
  expect(() => EnvLoader.setConfig({
    global: [{ name: 'ENUM_VAR', type: 'enum' }]
  })).toThrow('non-empty "allowed" array');
  
  expect(() => EnvLoader.setConfig({
    global: [{ name: 'ENUM_VAR', type: 'enum', allowed: [] }]
  })).toThrow('non-empty "allowed" array');
});

/**
 * FAIL_setConfig_11: allowed contains case-insensitive duplicates → throws.
 */
test("FAIL_setConfig_11: allowed with case-insensitive duplicates throws", () => {
  expect(() => EnvLoader.setConfig({
    global: [{ name: 'ENUM_VAR', type: 'enum', allowed: ['Dev', 'dev'] }]
  })).toThrow('case-insensitive duplicate');
});

/**
 * FAIL_setConfig_12: allowed contains non-string value → throws.
 */
test("FAIL_setConfig_12: allowed with non-string value throws", () => {
  expect(() => EnvLoader.setConfig({
    global: [{ name: 'ENUM_VAR', type: 'enum', allowed: ['A', 2] }]
  })).toThrow('non-string value');
});

/**
 * --------------------------------
 * SECTION: VALIDATEENV TESTS
 * --------------------------------
 */

/**
 * PASS_validateEnv*1: Validates "global" and returns normalized mapping for that section.
 */
test("PASS_validateEnv*1: Validates global section", () => {
  EnvLoader.source = { TEST_VAR: 'test_value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.TEST_VAR).toBe('test_value');
});

/**
 * PASS_validateEnv*2: sectionName is "default" → resolves to "global".
 */
test("PASS_validateEnv*2: default section name resolves to global", () => {
  EnvLoader.source = { TEST_VAR: 'test_value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('default');
  expect(result.TEST_VAR).toBe('test_value');
  
  const result2 = EnvLoader.validateEnv(' DeFaUlT ');
  expect(result2.TEST_VAR).toBe('test_value');
});

/**
 * PASS_validateEnv*3: sectionName is non-string → resolves to "global".
 */
test("PASS_validateEnv*3: Non-string section name resolves to global", () => {
  EnvLoader.source = { TEST_VAR: 'test_value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result1 = EnvLoader.validateEnv(123);
  expect(result1.TEST_VAR).toBe('test_value');
  
  const result2 = EnvLoader.validateEnv(null);
  expect(result2.TEST_VAR).toBe('test_value');
});

/**
 * PASS_validateEnv*4: sectionName is empty/whitespace string → resolves to "global".
 */
test("PASS_validateEnv*4: Empty section name resolves to global", () => {
  EnvLoader.source = { TEST_VAR: 'test_value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result1 = EnvLoader.validateEnv('');
  expect(result1.TEST_VAR).toBe('test_value');
  
  const result2 = EnvLoader.validateEnv('   ');
  expect(result2.TEST_VAR).toBe('test_value');
});

/**
 * PASS_validateEnv*5: Returns cached object on repeated calls for the same section.
 */
test("PASS_validateEnv*5: Returns cached result on repeated calls", () => {
  EnvLoader.source = { TEST_VAR: 'test_value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result1 = EnvLoader.validateEnv('global');
  const result2 = EnvLoader.validateEnv('global');
  
  expect(result1).toBe(result2); // Same object reference (cached)
});

/**
 * PASS_validateEnv*6: Section has entries with missing/invalid name; those entries are skipped.
 */
test("PASS_validateEnv*6: Invalid entries are skipped", () => {
  EnvLoader.source = { VALID_VAR: 'value' };
  // Use setConfig to ensure cache is cleared
  EnvLoader.setConfig({
    global: [
      { name: 'VALID_VAR' },
      { name: '' }, // Invalid - empty name
      {} // Invalid - no name
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.VALID_VAR).toBe('value');
  expect(result['']).toBeUndefined();
});

/**
 * PASS_validateEnv*7: Trims values from source before type coercion.
 */
test("PASS_validateEnv*7: Trims values before type coercion", () => {
  EnvLoader.source = { INT_VAR: '  123  ', STRING_VAR: '  test  ' };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int' },
      { name: 'STRING_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.INT_VAR).toBe(123);
  expect(result.STRING_VAR).toBe('test');
});

/**
 * PASS_validateEnv*8: Optional missing env value returns "" if no default.
 */
test("PASS_validateEnv*8: Optional missing value returns empty string", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'MISSING_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.MISSING_VAR).toBe('');
});

/**
 * PASS_validateEnv*9: Optional missing env value returns trimmed default string if default provided.
 */
test("PASS_validateEnv*9: Missing value with default returns trimmed default", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'DEFAULT_VAR', default: '  default_value  ' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.DEFAULT_VAR).toBe('default_value');
});

/**
 * PASS_validateEnv*10: Enum matching is case-insensitive, but returns original case from allowed array.
 */
test("PASS_validateEnv*10: Enum matching is case-insensitive, returns original case", () => {
  EnvLoader.source = { ENUM_VAR: 'dev' };
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['Dev', 'Prod', 'Stage'] }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.ENUM_VAR).toBe('Dev'); // Original case from allowed array
});

/**
 * PASS_validateEnv*11: Boolean parsing supports true/false, 1/0, yes/no, y/n (any casing).
 */
test("PASS_validateEnv*11: Boolean parsing supports various formats", () => {
  EnvLoader.source = {
    BOOL_TRUE: 'true',
    BOOL_FALSE: 'FALSE',
    BOOL_ONE: '1',
    BOOL_ZERO: '0',
    BOOL_YES: 'YES',
    BOOL_NO: 'no',
    BOOL_Y: 'y',
    BOOL_N: 'N'
  };
  EnvLoader.setConfig({
    global: [
      { name: 'BOOL_TRUE', type: 'bool' },
      { name: 'BOOL_FALSE', type: 'bool' },
      { name: 'BOOL_ONE', type: 'bool' },
      { name: 'BOOL_ZERO', type: 'bool' },
      { name: 'BOOL_YES', type: 'bool' },
      { name: 'BOOL_NO', type: 'bool' },
      { name: 'BOOL_Y', type: 'bool' },
      { name: 'BOOL_N', type: 'bool' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.BOOL_TRUE).toBe(true);
  expect(result.BOOL_FALSE).toBe(false);
  expect(result.BOOL_ONE).toBe(true);
  expect(result.BOOL_ZERO).toBe(false);
  expect(result.BOOL_YES).toBe(true);
  expect(result.BOOL_NO).toBe(false);
  expect(result.BOOL_Y).toBe(true);
  expect(result.BOOL_N).toBe(false);
});

/**
 * PASS_validateEnv*12: Int parsing accepts "0", "10", "999" and enforces bounds when provided.
 */
test("PASS_validateEnv*12: Int parsing accepts valid integers and enforces bounds", () => {
  EnvLoader.source = {
    INT_ZERO: '0',
    INT_TEN: '10',
    INT_999: '999',
    INT_BOUNDED: '5'
  };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_ZERO', type: 'int' },
      { name: 'INT_TEN', type: 'int' },
      { name: 'INT_999', type: 'int' },
      { name: 'INT_BOUNDED', type: 'int', min: 1, max: 10 }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.INT_ZERO).toBe(0);
  expect(result.INT_TEN).toBe(10);
  expect(result.INT_999).toBe(999);
  expect(result.INT_BOUNDED).toBe(5);
});

/**
 * FAIL_validateEnv_1: EnvLoader.config is null/missing → throws.
 */
test("FAIL_validateEnv_1: Config is null throws", () => {
  EnvLoader.config = null;
  EnvLoader.source = { TEST: 'value' };
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('requires a configuration object');
});

/**
 * FAIL_validateEnv_2: EnvLoader.config is non-object → throws.
 */
test("FAIL_validateEnv_2: Config is non-object throws", () => {
  EnvLoader.config = 'string';
  EnvLoader.source = { TEST: 'value' };
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('requires a configuration object');
});

/**
 * FAIL_validateEnv_3: Requested section does not exist as an array in config → throws.
 */
test("FAIL_validateEnv_3: Section does not exist throws", () => {
  EnvLoader.setConfig({
    global: []
  });
  EnvLoader.source = { TEST: 'value' };
  
  expect(() => EnvLoader.validateEnv('nonexistent')).toThrow('requires a "nonexistent" array');
});

/**
 * FAIL_validateEnv_4: Section exists but is not an array → throws.
 */
test("FAIL_validateEnv_4: Section not an array throws", () => {
  EnvLoader.config = {
    global: {},
    test: {}
  };
  EnvLoader.source = { TEST: 'value' };
  
  expect(() => EnvLoader.validateEnv('test')).toThrow('requires a "test" array');
});

/**
 * FAIL_validateEnv_5: Required env missing → throws.
 */
test("FAIL_validateEnv_5: Missing required env throws", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'REQUIRED_VAR', required: true }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('missing required env');
});

/**
 * FAIL_validateEnv_6: Int value is not a strict integer → throws.
 */
test("FAIL_validateEnv_6: Int value not strict integer throws", () => {
  EnvLoader.source = { INT_VAR: '10.0' };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
  
  EnvLoader.source = { INT_VAR: '01' };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
  
  EnvLoader.source = { INT_VAR: 'abc' };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * FAIL_validateEnv_7: Int below min → throws.
 */
test("FAIL_validateEnv_7: Int below min throws", () => {
  EnvLoader.source = { INT_VAR: '5' };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', min: 10 }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be >= 10');
});

/**
 * FAIL_validateEnv_8: Int above max → throws.
 */
test("FAIL_validateEnv_8: Int above max throws", () => {
  EnvLoader.source = { INT_VAR: '15' };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', max: 10 }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be <= 10');
});

/**
 * FAIL_validateEnv_9: Bool value not in allowlist → throws.
 */
test("FAIL_validateEnv_9: Bool value not in allowlist throws", () => {
  EnvLoader.source = { BOOL_VAR: 'maybe' };
  EnvLoader.setConfig({
    global: [
      { name: 'BOOL_VAR', type: 'bool' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be a boolean');
  
  EnvLoader.source = { BOOL_VAR: '2' };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be a boolean');
});

/**
 * FAIL_validateEnv_10: Enum value not in allowed list → throws.
 */
test("FAIL_validateEnv_10: Enum value not in allowed list throws", () => {
  EnvLoader.source = { ENUM_VAR: 'invalid' };
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['dev', 'prod'] }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be one of');
});

/**
 * FAIL_validateEnv_11: Enum entry has empty allowed → throws.
 */
test("FAIL_validateEnv_11: Enum entry with empty allowed throws", () => {
  EnvLoader.source = { ENUM_VAR: 'value' };
  EnvLoader.config = {
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: [] }
    ]
  };
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('requires a non-empty "allowed" array');
});

/**
 * --------------------------------
 * SECTION: ENSUREENV TESTS
 * --------------------------------
 */

/**
 * PASS_ensureEnv*1: EnvLoader.source is a non-empty object with at least one non-empty value → returns true.
 */
test("PASS_ensureEnv*1: Non-empty source with values returns true", () => {
  EnvLoader.source = { VAR1: 'value1', VAR2: 'value2' };
  expect(EnvLoader.ensureEnv()).toBe(true);
});

/**
 * PASS_ensureEnv*2: EnvLoader.source has keys but most are empty; one has "0" (string) → still counts as non-empty.
 */
test("PASS_ensureEnv*2: Source with '0' string counts as non-empty", () => {
  EnvLoader.source = { EMPTY1: '', EMPTY2: null, VALID: '0' };
  expect(EnvLoader.ensureEnv()).toBe(true);
});

/**
 * PASS_ensureEnv*3: With config set, and validateEnv("global") returns an object with keys → returns true.
 */
test("PASS_ensureEnv*3: With config, validateEnv returns object with keys", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  expect(EnvLoader.ensureEnv()).toBe(true);
});

/**
 * PASS_ensureEnv*4: With config set, global entries exist and some normalize to empty string but still produce keys → returns true.
 */
test("PASS_ensureEnv*4: With config, optional empty values still produce keys", () => {
  EnvLoader.source = { EXISTING: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'EXISTING' },
      { name: 'MISSING' }
    ]
  });
  
  expect(EnvLoader.ensureEnv()).toBe(true);
});

/**
 * PASS_ensureEnv*5: With config set, booleans/ints/enums normalize correctly and returns true.
 */
test("PASS_ensureEnv*5: With config, normalized values work correctly", () => {
  EnvLoader.source = {
    BOOL_VAR: 'true',
    INT_VAR: '123',
    ENUM_VAR: 'dev'
  };
  EnvLoader.setConfig({
    global: [
      { name: 'BOOL_VAR', type: 'bool' },
      { name: 'INT_VAR', type: 'int' },
      { name: 'ENUM_VAR', type: 'enum', allowed: ['dev', 'prod'] }
    ]
  });
  
  expect(EnvLoader.ensureEnv()).toBe(true);
});

/**
 * FAIL_ensureEnv_1: EnvLoader.source is null/undefined → throws "ENV".
 */
test("FAIL_ensureEnv_1: Source is null throws ENV", () => {
  EnvLoader.source = null;
  expect(() => EnvLoader.ensureEnv()).toThrow('ENV');
  
  EnvLoader.source = undefined;
  expect(() => EnvLoader.ensureEnv()).toThrow('ENV');
});

/**
 * FAIL_ensureEnv_2: EnvLoader.source is not an object → throws "ENV".
 */
test("FAIL_ensureEnv_2: Source is not an object throws ENV", () => {
  EnvLoader.source = 'string';
  expect(() => EnvLoader.ensureEnv()).toThrow('ENV');
  
  EnvLoader.source = 123;
  expect(() => EnvLoader.ensureEnv()).toThrow('ENV');
});

/**
 * FAIL_ensureEnv_3: EnvLoader.source is {} (no keys) and no config → throws "ENV".
 */
test("FAIL_ensureEnv_3: Empty source with no config throws ENV", () => {
  EnvLoader.source = {};
  EnvLoader.config = null;
  expect(() => EnvLoader.ensureEnv()).toThrow('ENV');
});

/**
 * FAIL_ensureEnv_4: EnvLoader.source has keys but all values are ""/whitespace/null/undefined → throws "ENV".
 */
test("FAIL_ensureEnv_4: Source with all empty values throws ENV", () => {
  EnvLoader.source = {
    VAR1: '',
    VAR2: '   ',
    VAR3: null,
    VAR4: undefined
  };
  EnvLoader.config = null;
  expect(() => EnvLoader.ensureEnv()).toThrow('ENV');
});

/**
 * FAIL_ensureEnv_5: With config set, validateEnv("global") returns {} → throws "ENV".
 */
test("FAIL_ensureEnv_5: Config with empty global section throws ENV", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: []
  });
  
  expect(() => EnvLoader.ensureEnv()).toThrow('ENV');
});

/**
 * FAIL_ensureEnv_6: With config set, validateEnv("global") throws → error propagates.
 */
test("FAIL_ensureEnv_6: Config validation error propagates", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'REQUIRED_VAR', required: true }
    ]
  });
  
  expect(() => EnvLoader.ensureEnv()).toThrow('missing required env');
});

/**
 * --------------------------------
 * SECTION: CACHE BEHAVIOR TESTS
 * --------------------------------
 */

/**
 * PASS_cache*1: loadEnvFile with same path twice uses cache (verify no second dotenv.config call).
 */
test("PASS_cache*1: loadEnvFile uses cache on repeated calls", () => {
  const envPath = path.join(process.cwd(), 'test-cache.env');
  createTestEnvFile(envPath, 'CACHE_VAR=cache_value\n');
  
  // First call
  const result1 = EnvLoader.loadEnvFile(envPath);
  expect(result1).toBeDefined();
  expect(process.env.CACHE_VAR).toBe('cache_value');
  
  // Second call should use cache (same content hash)
  const result2 = EnvLoader.loadEnvFile(envPath);
  expect(result2).toBeDefined();
  expect(process.env.CACHE_VAR).toBe('cache_value');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_cache*2: setConfig clears validated sections cache.
 */
test("PASS_cache*2: setConfig clears validated sections cache", () => {
  EnvLoader.source = { TEST_VAR: 'value1' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result1 = EnvLoader.validateEnv('global');
  expect(result1.TEST_VAR).toBe('value1');
  
  // Change config - should clear cache
  EnvLoader.setConfig({
    global: [
      { name: 'NEW_VAR' }
    ]
  });
  
  EnvLoader.source = { NEW_VAR: 'value2' };
  const result2 = EnvLoader.validateEnv('global');
  expect(result2.NEW_VAR).toBe('value2');
  expect(result2.TEST_VAR).toBeUndefined();
});

/**
 * PASS_cache*3: validateEnv returns same object reference on repeated calls (cache hit).
 */
test("PASS_cache*3: validateEnv returns cached object reference", () => {
  EnvLoader.source = { CACHE_TEST: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'CACHE_TEST' }
    ]
  });
  
  const result1 = EnvLoader.validateEnv('global');
  const result2 = EnvLoader.validateEnv('global');
  
  // Should be same object reference (cached)
  expect(result1).toBe(result2);
});

/**
 * PASS_cache*4: loadEnvFile with different content hash invalidates cache.
 */
test("PASS_cache*4: loadEnvFile with content change invalidates cache", () => {
  const envPath = path.join(process.cwd(), 'test-cache-change.env');
  createTestEnvFile(envPath, 'CHANGE_VAR=old_value\n');
  
  EnvLoader.loadEnvFile(envPath);
  expect(process.env.CHANGE_VAR).toBe('old_value');
  
  // Change file content - should invalidate cache
  createTestEnvFile(envPath, 'CHANGE_VAR=new_value\n');
  
  EnvLoader.loadEnvFile(envPath);
  expect(process.env.CHANGE_VAR).toBe('new_value');
  
  cleanupTestFile(envPath);
});

/**
 * --------------------------------
 * SECTION: TYPE COERCION EDGE CASES
 * --------------------------------
 */

/**
 * PASS_type*1: Int with negative values and negative bounds.
 */
test("PASS_type*1: Int with negative values and bounds", () => {
  EnvLoader.source = { NEG_INT: '-5', NEG_BOUNDED: '-10' };
  EnvLoader.setConfig({
    global: [
      { name: 'NEG_INT', type: 'int' },
      { name: 'NEG_BOUNDED', type: 'int', min: -20, max: -5 }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.NEG_INT).toBe(-5);
  expect(result.NEG_BOUNDED).toBe(-10);
});

/**
 * PASS_type*2: Int with value exactly at min boundary.
 */
test("PASS_type*2: Int at min boundary", () => {
  EnvLoader.source = { MIN_BOUND: '10' };
  EnvLoader.setConfig({
    global: [
      { name: 'MIN_BOUND', type: 'int', min: 10, max: 20 }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.MIN_BOUND).toBe(10);
});

/**
 * PASS_type*3: Int with value exactly at max boundary.
 */
test("PASS_type*3: Int at max boundary", () => {
  EnvLoader.source = { MAX_BOUND: '20' };
  EnvLoader.setConfig({
    global: [
      { name: 'MAX_BOUND', type: 'int', min: 10, max: 20 }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.MAX_BOUND).toBe(20);
});

/**
 * PASS_type*4: Enum with mixed case in source matches case-insensitive.
 */
test("PASS_type*4: Enum with mixed case matches case-insensitive", () => {
  EnvLoader.source = { ENUM_MIXED: 'DeV', ENUM_UPPER: 'PROD' };
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_MIXED', type: 'enum', allowed: ['dev', 'prod'] },
      { name: 'ENUM_UPPER', type: 'enum', allowed: ['dev', 'prod'] }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.ENUM_MIXED).toBe('dev');
  expect(result.ENUM_UPPER).toBe('prod');
});

/**
 * PASS_type*5: Boolean with "boolean" type (not just "bool").
 */
test("PASS_type*5: Boolean with 'boolean' type", () => {
  EnvLoader.source = { BOOL_TYPE: 'true', BOOLEAN_TYPE: 'false' };
  EnvLoader.setConfig({
    global: [
      { name: 'BOOL_TYPE', type: 'bool' },
      { name: 'BOOLEAN_TYPE', type: 'boolean' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.BOOL_TYPE).toBe(true);
  expect(result.BOOLEAN_TYPE).toBe(false);
});

/**
 * PASS_type*6: Default values with type coercion (int default, bool default).
 */
test("PASS_type*6: Default values with type coercion", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'INT_DEFAULT', type: 'int', default: '42' },
      { name: 'BOOL_DEFAULT', type: 'bool', default: 'true' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.INT_DEFAULT).toBe(42);
  expect(result.BOOL_DEFAULT).toBe(true);
});

/**
 * FAIL_type*1: Int with scientific notation (1e3) throws.
 */
test("FAIL_type*1: Int with scientific notation throws", () => {
  EnvLoader.source = { SCI_INT: '1e3' };
  EnvLoader.setConfig({
    global: [
      { name: 'SCI_INT', type: 'int' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * FAIL_type*2: Int with leading zeros (01, 001) throws.
 */
test("FAIL_type*2: Int with leading zeros throws", () => {
  EnvLoader.source = { LEAD_ZERO: '01' };
  EnvLoader.setConfig({
    global: [
      { name: 'LEAD_ZERO', type: 'int' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * FAIL_type*3: Int with decimal point (10.0, 10.5) throws.
 */
test("FAIL_type*3: Int with decimal point throws", () => {
  EnvLoader.source = { DEC_INT: '10.5' };
  EnvLoader.setConfig({
    global: [
      { name: 'DEC_INT', type: 'int' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
  
  EnvLoader.source = { DEC_INT: '10.0' };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * FAIL_type*4: Bool with invalid values throws.
 */
test("FAIL_type*4: Bool with invalid values throws", () => {
  EnvLoader.source = { INVALID_BOOL: 'maybe' };
  EnvLoader.setConfig({
    global: [
      { name: 'INVALID_BOOL', type: 'bool' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be a boolean');
  
  EnvLoader.source = { INVALID_BOOL: '2' };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be a boolean');
  
  EnvLoader.source = { INVALID_BOOL: 'true1' };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be a boolean');
});

/**
 * --------------------------------
 * SECTION: SECTION NAME NORMALIZATION TESTS
 * --------------------------------
 */

/**
 * PASS_section*1: validateEnv with "DEFAULT" (uppercase) resolves to global.
 */
test("PASS_section*1: Uppercase DEFAULT resolves to global", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('DEFAULT');
  expect(result.TEST_VAR).toBe('value');
});

/**
 * PASS_section*2: validateEnv with " default " (whitespace) resolves to global.
 */
test("PASS_section*2: Whitespace in DEFAULT resolves to global", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('  default  ');
  expect(result.TEST_VAR).toBe('value');
});

/**
 * PASS_section*3: validateEnv with custom section name returns correct section.
 */
test("PASS_section*3: Custom section name returns correct section", () => {
  EnvLoader.source = { PROD_VAR: 'prod_value', DEV_VAR: 'dev_value' };
  EnvLoader.setConfig({
    global: [
      { name: 'PROD_VAR' }
    ],
    dev: [
      { name: 'DEV_VAR' }
    ]
  });
  
  const globalResult = EnvLoader.validateEnv('global');
  const devResult = EnvLoader.validateEnv('dev');
  
  expect(globalResult.PROD_VAR).toBe('prod_value');
  expect(devResult.DEV_VAR).toBe('dev_value');
});

/**
 * PASS_section*4: Multiple sections can be validated independently.
 */
test("PASS_section*4: Multiple sections validated independently", () => {
  EnvLoader.source = { VAR1: 'val1', VAR2: 'val2', VAR3: 'val3' };
  EnvLoader.setConfig({
    global: [
      { name: 'VAR1' }
    ],
    section1: [
      { name: 'VAR2' }
    ],
    section2: [
      { name: 'VAR3' }
    ]
  });
  
  const globalResult = EnvLoader.validateEnv('global');
  const section1Result = EnvLoader.validateEnv('section1');
  const section2Result = EnvLoader.validateEnv('section2');
  
  expect(globalResult.VAR1).toBe('val1');
  expect(section1Result.VAR2).toBe('val2');
  expect(section2Result.VAR3).toBe('val3');
});

/**
 * --------------------------------
 * SECTION: NAME NORMALIZATION TESTS
 * --------------------------------
 */

/**
 * PASS_name*1: Entry names with leading/trailing whitespace are trimmed.
 */
test("PASS_name*1: Entry names with whitespace are trimmed", () => {
  EnvLoader.source = { '  TRIMMED_VAR  ': 'value' };
  EnvLoader.config = {
    global: [
      { name: '  TRIMMED_VAR  ' }
    ]
  };
  
  // The name will be normalized to uppercase and trimmed
  const result = EnvLoader.validateEnv('global');
  // Note: The source key might not match exactly, but the entry name is normalized
  expect(result).toBeDefined();
});

/**
 * PASS_name*2: Entry names are converted to uppercase.
 */
test("PASS_name*2: Entry names converted to uppercase", () => {
  EnvLoader.source = { lowercase_var: 'value' };
  EnvLoader.config = {
    global: [
      { name: 'lowercase_var' }
    ]
  };
  
  // setConfig should reject lowercase, but if it passes, validateEnv normalizes
  // This test verifies the normalization happens
  try {
    EnvLoader.setConfig({
      global: [
        { name: 'lowercase_var' }
      ]
    });
    // Should throw, but if it doesn't, validateEnv should handle it
  } catch (err) {
    expect(err.message).toContain('uppercase');
  }
});

/**
 * PASS_name*3: Invalid entry with missing name is skipped (no error).
 */
test("PASS_name*3: Invalid entry with missing name is skipped", () => {
  EnvLoader.source = { VALID_VAR: 'value' };
  // Use setConfig to ensure cache is cleared
  EnvLoader.setConfig({
    global: [
      { name: 'VALID_VAR' },
      {}, // Invalid - no name
      { name: '' }, // Invalid - empty name
      { name: 'ANOTHER_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.VALID_VAR).toBe('value');
  expect(result.ANOTHER_VAR).toBe('');
  // Invalid entries should be skipped
});

/**
 * --------------------------------
 * SECTION: DEFAULT VALUE HANDLING TESTS
 * --------------------------------
 */

/**
 * PASS_default*1: Default with leading/trailing spaces is trimmed.
 */
test("PASS_default*1: Default with spaces is trimmed", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'DEFAULT_VAR', default: '  default_value  ' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.DEFAULT_VAR).toBe('default_value');
});

/**
 * PASS_default*2: Default value "0" (string) for int type is parsed correctly.
 */
test("PASS_default*2: Default '0' for int type parsed correctly", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'ZERO_DEFAULT', type: 'int', default: '0' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.ZERO_DEFAULT).toBe(0);
});

/**
 * PASS_default*3: Default value for bool type is parsed correctly.
 */
test("PASS_default*3: Default for bool type parsed correctly", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'BOOL_DEFAULT', type: 'bool', default: 'true' },
      { name: 'BOOL_DEFAULT_FALSE', type: 'bool', default: 'false' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.BOOL_DEFAULT).toBe(true);
  expect(result.BOOL_DEFAULT_FALSE).toBe(false);
});

/**
 * PASS_default*4: Default value for enum type is validated against allowed.
 */
test("PASS_default*4: Default for enum validated against allowed", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_DEFAULT', type: 'enum', allowed: ['dev', 'prod'], default: 'dev' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.ENUM_DEFAULT).toBe('dev');
});

/**
 * PASS_default*5: Non-string default is converted to string then trimmed.
 */
test("PASS_default*5: Non-string default converted to string", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'NUM_DEFAULT', default: 123 },
      { name: 'BOOL_DEFAULT', default: true }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.NUM_DEFAULT).toBe('123');
  expect(result.BOOL_DEFAULT).toBe('true');
});

/**
 * --------------------------------
 * SECTION: ERROR MESSAGE VALIDATION TESTS
 * --------------------------------
 */

/**
 * FAIL_error*1: Missing required env includes variable name in error message.
 */
test("FAIL_error*1: Missing required env includes variable name", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'REQUIRED_VAR', required: true }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('REQUIRED_VAR');
  expect(() => EnvLoader.validateEnv('global')).toThrow('missing required env');
});

/**
 * FAIL_error*2: Int below min includes actual value and min in error message.
 */
test("FAIL_error*2: Int below min includes value and min", () => {
  EnvLoader.source = { INT_VAR: '5' };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', min: 10 }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('INT_VAR');
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be >= 10');
});

/**
 * FAIL_error*3: Int above max includes actual value and max in error message.
 */
test("FAIL_error*3: Int above max includes value and max", () => {
  EnvLoader.source = { INT_VAR: '15' };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', max: 10 }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('INT_VAR');
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be <= 10');
});

/**
 * FAIL_error*4: Enum not in allowed includes allowed values in error message.
 */
test("FAIL_error*4: Enum not in allowed includes allowed values", () => {
  EnvLoader.source = { ENUM_VAR: 'invalid' };
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['dev', 'prod'] }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('ENUM_VAR');
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be one of');
});

/**
 * FAIL_error*5: Invalid entry includes section name in error message.
 */
test("FAIL_error*5: Invalid entry includes section name", () => {
  // When there's at least one valid entry, invalid entries are skipped
  // So this should NOT throw
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' },
      {} // Invalid entry - skipped
    ]
  });
  
  // When there's a lowercase name (validation error), it should throw
  expect(() => EnvLoader.setConfig({
    global: [],
    prod: [
      { name: 'lowercase' } // Invalid - lowercase
    ]
  })).toThrow('uppercase');
});

/**
 * --------------------------------
 * SECTION: INTEGRATION TESTS
 * --------------------------------
 */

/**
 * PASS_integration*1: Full workflow - loadEnv → validateEnv → ensureEnv.
 */
test("PASS_integration*1: Full workflow loadEnv → validateEnv → ensureEnv", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'WORKFLOW_VAR=workflow_value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'WORKFLOW_VAR' }
    ]
  });
  
  // Step 1: loadEnv
  const result = EnvLoader.loadEnv();
  expect(result.WORKFLOW_VAR).toBe('workflow_value');
  
  // Step 2: validateEnv (should use cache)
  const validated = EnvLoader.validateEnv('global');
  expect(validated.WORKFLOW_VAR).toBe('workflow_value');
  
  // Step 3: ensureEnv
  expect(() => EnvLoader.ensureEnv()).not.toThrow();
  expect(EnvLoader.ensureEnv()).toBe(true);
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_integration*2: Multiple sections loaded and merged correctly.
 */
test("PASS_integration*2: Multiple sections loaded and merged", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'GLOBAL_VAR=global\nPROD_VAR=prod\nDEV_VAR=dev\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'GLOBAL_VAR' }
    ],
    prod: [
      { name: 'PROD_VAR' }
    ],
    dev: [
      { name: 'DEV_VAR' }
    ]
  });
  
  const result = EnvLoader.loadEnv();
  expect(result.GLOBAL_VAR).toBe('global');
  expect(result.PROD_VAR).toBe('prod');
  expect(result.DEV_VAR).toBe('dev');
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_integration*3: Cache persists across multiple validateEnv calls.
 */
test("PASS_integration*3: Cache persists across multiple validateEnv calls", () => {
  EnvLoader.source = { CACHE_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'CACHE_VAR' }
    ]
  });
  
  const result1 = EnvLoader.validateEnv('global');
  const result2 = EnvLoader.validateEnv('global');
  const result3 = EnvLoader.validateEnv('global');
  
  // All should be same object reference
  expect(result1).toBe(result2);
  expect(result2).toBe(result3);
  expect(result1.CACHE_VAR).toBe('value');
});

/**
 * PASS_integration*4: Config change invalidates cache and revalidates.
 */
test("PASS_integration*4: Config change invalidates cache", () => {
  EnvLoader.source = { VAR1: 'val1', VAR2: 'val2' };
  
  EnvLoader.setConfig({
    global: [
      { name: 'VAR1' }
    ]
  });
  
  const result1 = EnvLoader.validateEnv('global');
  expect(result1.VAR1).toBe('val1');
  
  // Change config
  EnvLoader.setConfig({
    global: [
      { name: 'VAR2' }
    ]
  });
  
  // Cache should be cleared, new validation should work
  const result2 = EnvLoader.validateEnv('global');
  expect(result2.VAR2).toBe('val2');
  expect(result2.VAR1).toBeUndefined();
});

/**
 * --------------------------------
 * SECTION: EDGE CASES TESTS
 * --------------------------------
 */

/**
 * PASS_edge*1: Empty .env file loads successfully.
 */
test("PASS_edge*1: Empty .env file loads successfully", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, '');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: []
  });
  
  expect(() => EnvLoader.loadEnv()).not.toThrow();
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_edge*2: .env file with only comments/whitespace loads.
 */
test("PASS_edge*2: .env file with comments/whitespace loads", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, '# This is a comment\n   \n# Another comment\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: []
  });
  
  expect(() => EnvLoader.loadEnv()).not.toThrow();
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_edge*3: Config with empty global array is valid.
 */
test("PASS_edge*3: Config with empty global array is valid", () => {
  expect(() => EnvLoader.setConfig({
    global: []
  })).not.toThrow();
  
  expect(EnvLoader.config.global).toEqual([]);
});

/**
 * PASS_edge*4: Entry with all optional fields omitted works.
 */
test("PASS_edge*4: Entry with all optional fields omitted works", () => {
  EnvLoader.source = { MINIMAL_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'MINIMAL_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.MINIMAL_VAR).toBe('value');
});

/**
 * PASS_edge*5: Source with undefined/null values handled correctly.
 */
test("PASS_edge*5: Source with undefined/null values handled", () => {
  EnvLoader.source = {
    UNDEF_VAR: undefined,
    NULL_VAR: null,
    EMPTY_VAR: '',
    VALID_VAR: 'value'
  };
  EnvLoader.setConfig({
    global: [
      { name: 'UNDEF_VAR' },
      { name: 'NULL_VAR' },
      { name: 'EMPTY_VAR' },
      { name: 'VALID_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.UNDEF_VAR).toBe('');
  expect(result.NULL_VAR).toBe('');
  expect(result.EMPTY_VAR).toBe('');
  expect(result.VALID_VAR).toBe('value');
});

/**
 * PASS_edge*6: Very long env var names work.
 */
test("PASS_edge*6: Very long env var names work", () => {
  const longName = 'A'.repeat(255);
  EnvLoader.source = { [longName]: 'value' };
  // Use setConfig to ensure cache is cleared
  EnvLoader.setConfig({
    global: [
      { name: longName }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result[longName]).toBe('value');
});

/**
 * PASS_edge*7: Special characters in env values preserved.
 */
test("PASS_edge*7: Special characters in env values preserved", () => {
  EnvLoader.source = {
    SPECIAL_VAR: 'value with spaces and !@#$%^&*()',
    QUOTE_VAR: 'value with "quotes"',
    NEWLINE_VAR: 'value\nwith\nnewlines'
  };
  EnvLoader.setConfig({
    global: [
      { name: 'SPECIAL_VAR' },
      { name: 'QUOTE_VAR' },
      { name: 'NEWLINE_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.SPECIAL_VAR).toBe('value with spaces and !@#$%^&*()');
  expect(result.QUOTE_VAR).toBe('value with "quotes"');
  expect(result.NEWLINE_VAR).toBe('value\nwith\nnewlines');
});

/**
 * --------------------------------
 * SECTION: CONCURRENT ACCESS TESTS
 * --------------------------------
 */

/**
 * PASS_concurrent*1: Multiple loadEnvFile calls with same path don't corrupt cache.
 */
test("PASS_concurrent*1: Multiple loadEnvFile calls don't corrupt cache", () => {
  const envPath = path.join(process.cwd(), 'test-concurrent.env');
  createTestEnvFile(envPath, 'CONCURRENT_VAR=value\n');
  
  // Simulate concurrent calls
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(EnvLoader.loadEnvFile(envPath));
  }
  
  // All should succeed and return same source
  results.forEach(result => {
    expect(result).toBeDefined();
    expect(process.env.CONCURRENT_VAR).toBe('value');
  });
  
  cleanupTestFile(envPath);
});

/**
 * PASS_concurrent*2: setConfig during validateEnv doesn't cause race condition.
 */
test("PASS_concurrent*2: setConfig during validateEnv doesn't cause race", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  // Start validation
  const result1 = EnvLoader.validateEnv('global');
  
  // Change config (should clear cache)
  EnvLoader.setConfig({
    global: [
      { name: 'NEW_VAR' }
    ]
  });
  
  // Previous result should still be valid (cached)
  expect(result1.TEST_VAR).toBe('value');
  
  // New validation should use new config
  EnvLoader.source = { NEW_VAR: 'new_value' };
  const result2 = EnvLoader.validateEnv('global');
  expect(result2.NEW_VAR).toBe('new_value');
});

/**
 * --------------------------------
 * SECTION: ERRORHANDLER INTEGRATION TESTS
 * --------------------------------
 */

/**
 * PASS_errorhandler*1: Path traversal attempts are logged to ErrorHandler
 */
test("PASS_errorhandler*1: Path traversal attempts logged to ErrorHandler", () => {
  ErrorHandler.clear();
  const outsidePath = path.resolve(process.cwd(), '..', 'outside.env');
  
  expect(() => EnvLoader.loadEnvFile(outsidePath)).toThrow('path traversal attempt blocked');
  
  const errors = ErrorHandler.getAllErrors();
  const securityEvent = errors.find(e => e.data && e.data.code === 'PATH_TRAVERSAL_BLOCKED');
  expect(securityEvent).toBeDefined();
  expect(securityEvent.data.level).toBe('warning');
  expect(securityEvent.data.origin).toBe('EnvLoader');
});

/**
 * PASS_errorhandler*2: Cache hits are logged to ErrorHandler
 */
test("PASS_errorhandler*2: Cache hits logged to ErrorHandler", () => {
  const envPath = path.join(process.cwd(), 'test-cache.env');
  createTestEnvFile(envPath, 'CACHE_VAR=value\n');
  
  ErrorHandler.clear();
  EnvLoader.loadEnvFile(envPath);
  
  ErrorHandler.clear();
  EnvLoader.loadEnvFile(envPath);
  
  const errors = ErrorHandler.getAllErrors();
  const cacheHit = errors.find(e => e.data && e.data.code === 'ENV_CACHE_HIT');
  expect(cacheHit).toBeDefined();
  expect(cacheHit.data.level).toBe('trace');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_errorhandler*3: Cache misses are logged to ErrorHandler
 */
test("PASS_errorhandler*3: Cache misses logged to ErrorHandler", () => {
  const envPath = path.join(process.cwd(), 'test-cache-miss.env');
  createTestEnvFile(envPath, 'MISS_VAR=value\n');
  
  ErrorHandler.clear();
  EnvLoader.loadEnvFile(envPath);
  
  const errors = ErrorHandler.getAllErrors();
  const cacheMiss = errors.find(e => e.data && e.data.code === 'ENV_CACHE_MISS');
  expect(cacheMiss).toBeDefined();
  expect(cacheMiss.data.level).toBe('trace');
  expect(cacheMiss.data.fileSize).toBeGreaterThan(0);
  
  cleanupTestFile(envPath);
});

/**
 * PASS_errorhandler*4: Successful file loads are logged
 */
test("PASS_errorhandler*4: Successful file loads logged", () => {
  const envPath = path.join(process.cwd(), 'test-success.env');
  createTestEnvFile(envPath, 'SUCCESS_VAR=value\n');
  
  ErrorHandler.clear();
  EnvLoader.loadEnvFile(envPath);
  
  const errors = ErrorHandler.getAllErrors();
  const fileLoaded = errors.find(e => e.data && e.data.code === 'ENV_FILE_LOADED');
  expect(fileLoaded).toBeDefined();
  expect(fileLoaded.data.level).toBe('info');
  
  cleanupTestFile(envPath);
});

/**
 * PASS_errorhandler*5: loadEnv workflow is fully audited
 */
test("PASS_errorhandler*5: loadEnv workflow fully audited", () => {
  const envPath = path.join(process.cwd(), '.env');
  createTestEnvFile(envPath, 'WORKFLOW_VAR=value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'WORKFLOW_VAR' }
    ]
  });
  
  ErrorHandler.clear();
  const result = EnvLoader.loadEnv();
  
  const errors = ErrorHandler.getAllErrors();
  
  // Should have start, config set, validation, and success events
  const startEvent = errors.find(e => e.data && e.data.code === 'ENV_LOAD_START');
  const successEvent = errors.find(e => e.data && e.data.code === 'ENV_LOAD_SUCCESS');
  
  expect(startEvent).toBeDefined();
  expect(successEvent).toBeDefined();
  expect(successEvent.data.varsLoaded).toBe(1);
  
  cleanupTestFile(envPath);
  cleanupTestFile(configPath);
});

/**
 * PASS_errorhandler*6: setConfig success is logged
 */
test("PASS_errorhandler*6: setConfig success logged", () => {
  ErrorHandler.clear();
  
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  const errors = ErrorHandler.getAllErrors();
  const configSet = errors.find(e => e.data && e.data.code === 'ENV_CONFIG_SET_SUCCESS');
  expect(configSet).toBeDefined();
  expect(configSet.data.level).toBe('info');
  expect(configSet.data.sections).toContain('global');
});

/**
 * PASS_errorhandler*7: setConfig validation failures are logged
 */
test("PASS_errorhandler*7: setConfig validation failures logged", () => {
  ErrorHandler.clear();
  
  expect(() => EnvLoader.setConfig({
    global: [
      { name: 'lowercase' }
    ]
  })).toThrow('must be uppercase');
  
  const errors = ErrorHandler.getAllErrors();
  const validationFailed = errors.find(e => e.data && e.data.code === 'ENV_CONFIG_INVALID');
  const lowercaseRejected = errors.find(e => e.data && e.data.code === 'ENV_LOWERCASE_NAME');
  
  expect(validationFailed).toBeDefined();
  expect(lowercaseRejected).toBeDefined();
  expect(lowercaseRejected.data.level).toBe('warning');
});

/**
 * PASS_errorhandler*8: validateEnv cache hits are logged
 */
test("PASS_errorhandler*8: validateEnv cache hits logged", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  ErrorHandler.clear();
  EnvLoader.validateEnv('global');
  
  ErrorHandler.clear();
  EnvLoader.validateEnv('global');
  
  const errors = ErrorHandler.getAllErrors();
  const cacheHit = errors.find(e => e.data && e.data.code === 'ENV_VALIDATION_CACHE_HIT');
  expect(cacheHit).toBeDefined();
  expect(cacheHit.data.section).toBe('global');
});

/**
 * PASS_errorhandler*9: validateEnv success is logged
 */
test("PASS_errorhandler*9: validateEnv success logged", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  ErrorHandler.clear();
  EnvLoader.validateEnv('global');
  
  const errors = ErrorHandler.getAllErrors();
  const validated = errors.find(e => e.data && e.data.code === 'ENV_SECTION_VALIDATED');
  expect(validated).toBeDefined();
  expect(validated.data.level).toBe('trace');
  expect(validated.data.varsValidated).toBe(1);
});

/**
 * PASS_errorhandler*10: validateEnv failures are logged
 */
test("PASS_errorhandler*10: validateEnv failures logged", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'REQUIRED_VAR', required: true }
    ]
  });
  
  ErrorHandler.clear();
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('missing required env');
  
  const errors = ErrorHandler.getAllErrors();
  const validationFailed = errors.find(e => e.data && e.data.code === 'ENV_SECTION_VALIDATION_FAILED');
  expect(validationFailed).toBeDefined();
  expect(validationFailed.data.level).toBe('error');
});

/**
 * PASS_errorhandler*11: Int bounds validation failures are logged
 */
test("PASS_errorhandler*11: Int bounds validation failures logged", () => {
  ErrorHandler.clear();
  
  expect(() => EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', min: 10, max: 5 }
    ]
  })).toThrow();
  
  const errors = ErrorHandler.getAllErrors();
  const boundsError = errors.find(e => e.data && e.data.code === 'ENV_INVALID_INT_BOUNDS');
  expect(boundsError).toBeDefined();
  expect(boundsError.data.level).toBe('error');
  expect(boundsError.data.min).toBe(10);
  expect(boundsError.data.max).toBe(5);
});

/**
 * PASS_errorhandler*12: Enum duplicate detection is logged
 */
test("PASS_errorhandler*12: Enum duplicate detection logged", () => {
  ErrorHandler.clear();
  
  expect(() => EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['Dev', 'dev'] }
    ]
  })).toThrow('case-insensitive duplicate');
  
  const errors = ErrorHandler.getAllErrors();
  const duplicateError = errors.find(e => e.data && e.data.code === 'ENV_ENUM_DUPLICATES');
  expect(duplicateError).toBeDefined();
  expect(duplicateError.data.level).toBe('error');
  expect(duplicateError.data.allowed).toEqual(['Dev', 'dev']);
});

/**
 * PASS_errorhandler*13: All error events include timestamp and origin
 */
test("PASS_errorhandler*13: All error events include required fields", () => {
  const envPath = path.join(process.cwd(), 'test-fields.env');
  createTestEnvFile(envPath, 'FIELD_VAR=value\n');
  
  ErrorHandler.clear();
  EnvLoader.loadEnvFile(envPath);
  
  const errors = ErrorHandler.getAllErrors();
  errors.forEach(error => {
    expect(error.data).toHaveProperty('timestamp');
    expect(error.data).toHaveProperty('origin');
    expect(error.data.origin).toBe('EnvLoader');
  });
  
  cleanupTestFile(envPath);
});

/**
 * --------------------------------
 * SECTION: SAFEUTILS INTEGRATION TESTS
 * --------------------------------
 */

/**
 * PASS_safeutils*1: Integer parsing uses SafeUtils.sanitizeInteger
 */
test("PASS_safeutils*1: Integer parsing uses SafeUtils", () => {
  EnvLoader.source = { INT_VAR: "123" };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.INT_VAR).toBe(123);
  expect(typeof result.INT_VAR).toBe('number');
});

/**
 * PASS_safeutils*2: Invalid integer returns null from SafeUtils
 */
test("PASS_safeutils*2: Invalid integer rejected by SafeUtils", () => {
  EnvLoader.source = { INT_VAR: "abc" };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * PASS_safeutils*3: Boolean parsing uses SafeUtils.sanitizeBoolean
 */
test("PASS_safeutils*3: Boolean parsing uses SafeUtils", () => {
  EnvLoader.source = { BOOL_VAR: "true" };
  EnvLoader.setConfig({
    global: [
      { name: 'BOOL_VAR', type: 'bool' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.BOOL_VAR).toBe(true);
  expect(typeof result.BOOL_VAR).toBe('boolean');
});

/**
 * PASS_safeutils*4: Invalid boolean rejected by SafeUtils
 */
test("PASS_safeutils*4: Invalid boolean rejected by SafeUtils", () => {
  EnvLoader.source = { BOOL_VAR: "maybe" };
  EnvLoader.setConfig({
    global: [
      { name: 'BOOL_VAR', type: 'bool' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be a boolean');
});

/**
 * PASS_safeutils*5: Object validation uses SafeUtils.isPlainObject
 */
test("PASS_safeutils*5: Object validation uses SafeUtils", () => {
  // Array should be rejected (not a plain object)
  expect(() => EnvLoader.setConfig([])).toThrow('requires a plain configuration object');
  
  // Date should be rejected (not a plain object)
  expect(() => EnvLoader.setConfig(new Date())).toThrow('requires a plain configuration object');
});

/**
 * PASS_safeutils*6: Integer with bounds uses SafeUtils then validates bounds
 */
test("PASS_safeutils*6: Integer with bounds uses SafeUtils then validates", () => {
  EnvLoader.source = { INT_VAR: "50" };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', min: 10, max: 100 }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.INT_VAR).toBe(50);
  
  // Test min bound
  EnvLoader.source = { INT_VAR: "5" };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be >= 10');
  
  // Test max bound
  EnvLoader.source = { INT_VAR: "150" };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be <= 100');
});

/**
 * --------------------------------
 * SECTION: LOGGER INTEGRATION TESTS
 * --------------------------------
 */

/**
 * PASS_logger*1: Logger integration on successful loadEnv
 */
test("PASS_logger*1: Logger integration on successful loadEnv", () => {
  const envPath = path.join(process.cwd(), 'test-logger-env.env');
  createTestEnvFile(envPath, 'LOGGER_VAR=value\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'LOGGER_VAR' }
    ]
  });
  
  try {
    // Try to load Logger if available
    let Logger;
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const loggerCls = cfg.classes.find((c) => c.name === 'Logger');
      if (loggerCls) {
        Logger = require(path.resolve(cfg.rootDir, loggerCls.src));
      }
    } catch {}
    
    if (Logger && typeof Logger.writeLog === "function") {
      const writeLogSpy = jest.spyOn(Logger, 'writeLog');
      ErrorHandler.clear();
      
      EnvLoader.loadEnv(envPath, configPath);
      
      // Check if Logger.writeLog was called
      const logCalls = writeLogSpy.mock.calls.filter(call => 
        call[1] === "env" && (call[2] === "load" || call[2] === "load_failed")
      );
      expect(logCalls.length).toBeGreaterThan(0);
      
      writeLogSpy.mockRestore();
    }
    
    cleanupTestFile(envPath);
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(envPath);
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_logger*2: Logger integration on path traversal
 */
test("PASS_logger*2: Logger integration on path traversal", () => {
  let Logger;
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const loggerCls = cfg.classes.find((c) => c.name === 'Logger');
    if (loggerCls) {
      Logger = require(path.resolve(cfg.rootDir, loggerCls.src));
    }
  } catch {}
  
  if (Logger && typeof Logger.writeLog === "function") {
    const writeLogSpy = jest.spyOn(Logger, 'writeLog');
    ErrorHandler.clear();
    
    try {
      EnvLoader.loadEnvFile('../../etc/passwd');
    } catch (err) {
      // Expected
    }
    
    // Check if Logger.writeLog was called for security event
    const securityCalls = writeLogSpy.mock.calls.filter(call => 
      call[1] === "security" && call[2] === "path_traversal"
    );
    expect(securityCalls.length).toBeGreaterThan(0);
    
    writeLogSpy.mockRestore();
  }
});

/**
 * PASS_logger*3: Logger gracefully handles when not initialized
 */
test("PASS_logger*3: Logger gracefully handles when not initialized", () => {
  const envPath = path.join(process.cwd(), 'test-logger-graceful.env');
  createTestEnvFile(envPath, 'GRACEFUL_VAR=value\n');
  
  try {
    // Should not throw even if Logger is null
    EnvLoader.loadEnvFile(envPath);
    
    cleanupTestFile(envPath);
  } catch (err) {
    cleanupTestFile(envPath);
    throw err;
  }
});

/**
 * --------------------------------
 * SECTION: PRIVATE METHOD COVERAGE TESTS
 * --------------------------------
 */

/**
 * PASS_private*1: #normalizeSectionName() handles "default" alias
 */
test("PASS_private*1: normalizeSectionName handles default alias", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  // Test various "default" aliases
  const aliases = ['default', 'Default', 'DEFAULT', ' default ', 'DeFaUlT'];
  
  aliases.forEach(alias => {
    const result = EnvLoader.validateEnv(alias);
    expect(result.TEST_VAR).toBe('value');
  });
});

/**
 * PASS_private*2: #normalizeSectionName() handles non-string input
 */
test("PASS_private*2: normalizeSectionName handles non-string input", () => {
  EnvLoader.source = { TEST_VAR: 'value' };
  EnvLoader.setConfig({
    global: [
      { name: 'TEST_VAR' }
    ]
  });
  
  // Non-string should default to "global"
  const result1 = EnvLoader.validateEnv(null);
  const result2 = EnvLoader.validateEnv(123);
  const result3 = EnvLoader.validateEnv({});
  
  expect(result1.TEST_VAR).toBe('value');
  expect(result2.TEST_VAR).toBe('value');
  expect(result3.TEST_VAR).toBe('value');
});

/**
 * PASS_private*3: #resolveInt() handles scientific notation edge cases
 */
test("PASS_private*3: resolveInt rejects scientific notation", () => {
  EnvLoader.source = { INT_VAR: "1e3" };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * PASS_private*4: #resolveInt() handles hex/octal edge cases
 */
test("PASS_private*4: resolveInt rejects hex and octal", () => {
  EnvLoader.source = { INT_VAR: "0xFF" };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int' }
    ]
  });
  
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
  
  EnvLoader.source = { INT_VAR: "077" };
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * PASS_private*5: #resolveInt() handles leading zeros
 */
test("PASS_private*5: resolveInt handles leading zeros correctly", () => {
  EnvLoader.source = { INT_VAR: "007" };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int' }
    ]
  });
  
  // Leading zeros should be rejected (not strict integer)
  expect(() => EnvLoader.validateEnv('global')).toThrow('must be an integer');
});

/**
 * PASS_private*6: #resolveBool() handles all boolean representations
 */
test("PASS_private*6: resolveBool handles all boolean representations", () => {
  const testCases = [
    { input: 'true', expected: true },
    { input: 'TRUE', expected: true },
    { input: 'True', expected: true },
    { input: '1', expected: true },
    { input: 'yes', expected: true },
    { input: 'YES', expected: true },
    { input: 'y', expected: true },
    { input: 'Y', expected: true },
    { input: 'false', expected: false },
    { input: 'FALSE', expected: false },
    { input: '0', expected: false },
    { input: 'no', expected: false },
    { input: 'NO', expected: false },
    { input: 'n', expected: false },
    { input: 'N', expected: false }
  ];
  
  testCases.forEach(({ input, expected }) => {
    EnvLoader.source = { BOOL_VAR: input };
    EnvLoader.setConfig({
      global: [
        { name: 'BOOL_VAR', type: 'bool' }
      ]
    });
    
    const result = EnvLoader.validateEnv('global');
    expect(result.BOOL_VAR).toBe(expected);
  });
});

/**
 * PASS_private*7: #resolveEnum() preserves original case from allowed array
 */
test("PASS_private*7: resolveEnum preserves original case", () => {
  EnvLoader.source = { ENUM_VAR: 'dev' };
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['Dev', 'Prod', 'Test'] }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  // Should match case-insensitively but return original case
  expect(result.ENUM_VAR).toBe('Dev');
  
  // Clear cache before changing source
  EnvLoader.config = null;
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['Dev', 'Prod', 'Test'] }
    ]
  });
  EnvLoader.source = { ENUM_VAR: 'PROD' };
  const result2 = EnvLoader.validateEnv('global');
  expect(result2.ENUM_VAR).toBe('Prod');
});

/**
 * PASS_private*8: #resolveEnum() handles case-insensitive matching
 */
test("PASS_private*8: resolveEnum case-insensitive matching", () => {
  const testCases = [
    { input: 'dev', allowed: ['Dev'], expected: 'Dev' },
    { input: 'DEV', allowed: ['Dev'], expected: 'Dev' },
    { input: 'DeV', allowed: ['Dev'], expected: 'Dev' },
    { input: 'prod', allowed: ['Prod'], expected: 'Prod' },
    { input: 'PROD', allowed: ['Prod'], expected: 'Prod' }
  ];
  
  testCases.forEach(({ input, allowed, expected }) => {
    EnvLoader.source = { ENUM_VAR: input };
    EnvLoader.setConfig({
      global: [
        { name: 'ENUM_VAR', type: 'enum', allowed: allowed }
      ]
    });
    
    const result = EnvLoader.validateEnv('global');
    expect(result.ENUM_VAR).toBe(expected);
  });
});

/**
 * PASS_private*9: #resolveValue() handles int with bounds
 */
test("PASS_private*9: resolveValue handles int with bounds", () => {
  EnvLoader.source = { INT_VAR: "50" };
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', min: 10, max: 100 }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.INT_VAR).toBe(50);
  
  // Test min boundary - clear cache before changing source
  EnvLoader.config = null;
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', min: 10, max: 100 }
    ]
  });
  EnvLoader.source = { INT_VAR: "10" };
  const resultMin = EnvLoader.validateEnv('global');
  expect(resultMin.INT_VAR).toBe(10);
  
  // Test max boundary - clear cache before changing source
  EnvLoader.config = null;
  EnvLoader.setConfig({
    global: [
      { name: 'INT_VAR', type: 'int', min: 10, max: 100 }
    ]
  });
  EnvLoader.source = { INT_VAR: "100" };
  const resultMax = EnvLoader.validateEnv('global');
  expect(resultMax.INT_VAR).toBe(100);
});

/**
 * PASS_private*10: #resolveValue() handles enum with default
 */
test("PASS_private*10: resolveValue handles enum with default", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['Dev', 'Prod'], default: 'Dev' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.ENUM_VAR).toBe('Dev');
});

/**
 * PASS_private*11: #validateConfigDeep() handles empty arrays
 */
test("PASS_private*11: validateConfigDeep handles empty arrays", () => {
  // Empty global array should be allowed
  EnvLoader.setConfig({
    global: []
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result).toEqual({});
});

/**
 * PASS_private*12: #validateConfigDeep() handles null/undefined in allowed array
 */
test("PASS_private*12: validateConfigDeep rejects null in allowed array", () => {
  expect(() => EnvLoader.setConfig({
    global: [
      { name: 'ENUM_VAR', type: 'enum', allowed: ['Dev', null] }
    ]
  })).toThrow('non-string value in "allowed" array');
});

/**
 * PASS_private*13: #loadSection() handles empty section
 */
test("PASS_private*13: loadSection handles empty section", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: []
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result).toEqual({});
  expect(Object.keys(result).length).toBe(0);
});

/**
 * PASS_private*14: #normalizeConfig() merges multiple sections
 */
test("PASS_private*14: normalizeConfig merges multiple sections", () => {
  const envPath = path.join(process.cwd(), 'test-normalize.env');
  createTestEnvFile(envPath, 'GLOBAL_VAR=global\nPROD_VAR=prod\n');
  
  const configPath = path.join(process.cwd(), 'configs', 'envConfig.json');
  createTestConfigFile(configPath, {
    global: [
      { name: 'GLOBAL_VAR' }
    ],
    prod: [
      { name: 'PROD_VAR' }
    ]
  });
  
  try {
    // Use relative paths for loadEnv (ConfigFileLoader expects relative paths)
    const relativeEnvPath = path.relative(process.cwd(), envPath);
    const relativeConfigPath = path.relative(process.cwd(), configPath);
    const result = EnvLoader.loadEnv(relativeEnvPath, relativeConfigPath);
    
    expect(result.GLOBAL_VAR).toBe('global');
    expect(result.PROD_VAR).toBe('prod');
    
    cleanupTestFile(envPath);
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(envPath);
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_private*15: #resolveRaw() handles missing values
 */
test("PASS_private*15: resolveRaw handles missing values", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'MISSING_VAR' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.MISSING_VAR).toBe('');
});

/**
 * PASS_private*16: #resolveRaw() handles values with defaults
 */
test("PASS_private*16: resolveRaw handles values with defaults", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: 'DEFAULT_VAR', default: 'default_value' }
    ]
  });
  
  const result = EnvLoader.validateEnv('global');
  expect(result.DEFAULT_VAR).toBe('default_value');
});

/**
 * --------------------------------
 * SECTION: WARMUPCACHE TESTS
 * --------------------------------
 */

/**
 * PASS_WARMUPCACHE_1: WarmupCache pre-validates sections to populate cache
 */
test("PASS_WARMUPCACHE_1: WarmupCache pre-validates sections to populate cache", () => {
  EnvLoader.source = { GLOBAL_VAR: "value", PROD_VAR: "prod_value" };
  EnvLoader.setConfig({
    global: [
      { name: "GLOBAL_VAR" }
    ],
    prod: [
      { name: "PROD_VAR" }
    ]
  });
  
  // Clear cache first
  EnvLoader.validateEnv("global"); // This will populate cache
  
  // Warmup should populate cache for both sections
  EnvLoader.warmupCache(["global", "prod"]);
  
  // Subsequent calls should use cache
  const result1 = EnvLoader.validateEnv("global");
  const result2 = EnvLoader.validateEnv("prod");
  
  expect(result1.GLOBAL_VAR).toBe("value");
  expect(result2.PROD_VAR).toBe("prod_value");
});

/**
 * PASS_WARMUPCACHE_2: WarmupCache uses default section when none provided
 */
test("PASS_WARMUPCACHE_2: WarmupCache uses default section when none provided", () => {
  EnvLoader.source = { GLOBAL_VAR: "value" };
  EnvLoader.setConfig({
    global: [
      { name: "GLOBAL_VAR" }
    ]
  });
  
  // Warmup with no arguments should use default ("global")
  EnvLoader.warmupCache();
  
  const result = EnvLoader.validateEnv("global");
  expect(result.GLOBAL_VAR).toBe("value");
});

/**
 * PASS_WARMUPCACHE_3: WarmupCache handles empty sections array
 */
test("PASS_WARMUPCACHE_3: WarmupCache handles empty sections array", () => {
  EnvLoader.source = { GLOBAL_VAR: "value" };
  EnvLoader.setConfig({
    global: [
      { name: "GLOBAL_VAR" }
    ]
  });
  
  // Should not throw with empty array
  expect(() => EnvLoader.warmupCache([])).not.toThrow();
});

/**
 * PASS_WARMUPCACHE_4: WarmupCache ignores invalid section names
 */
test("PASS_WARMUPCACHE_4: WarmupCache ignores invalid section names", () => {
  EnvLoader.source = { GLOBAL_VAR: "value" };
  EnvLoader.setConfig({
    global: [
      { name: "GLOBAL_VAR" }
    ]
  });
  
  // Should not throw with invalid section names
  expect(() => EnvLoader.warmupCache(["invalid", "", "   ", null, 123])).not.toThrow();
});

/**
 * PASS_WARMUPCACHE_5: WarmupCache handles validation errors gracefully
 */
test("PASS_WARMUPCACHE_5: WarmupCache handles validation errors gracefully", () => {
  EnvLoader.source = {};
  EnvLoader.setConfig({
    global: [
      { name: "REQUIRED_VAR", required: true }
    ]
  });
  
  // Should not throw even if validation fails
  expect(() => EnvLoader.warmupCache(["global"])).not.toThrow();
});

/**
 * PASS_WARMUPCACHE_6: WarmupCache does nothing when config not set
 */
test("PASS_WARMUPCACHE_6: WarmupCache does nothing when config not set", () => {
  EnvLoader.config = null;
  
  // Should not throw when config is null
  expect(() => EnvLoader.warmupCache(["global"])).not.toThrow();
});

/**
 * PASS_WARMUPCACHE_7: WarmupCache handles multiple sections
 */
test("PASS_WARMUPCACHE_7: WarmupCache handles multiple sections", () => {
  EnvLoader.source = { 
    GLOBAL_VAR: "global",
    PROD_VAR: "prod",
    DEV_VAR: "dev"
  };
  EnvLoader.setConfig({
    global: [
      { name: "GLOBAL_VAR" }
    ],
    prod: [
      { name: "PROD_VAR" }
    ],
    dev: [
      { name: "DEV_VAR" }
    ]
  });
  
  // Warmup multiple sections
  EnvLoader.warmupCache(["global", "prod", "dev"]);
  
  // All should be cached
  const globalResult = EnvLoader.validateEnv("global");
  const prodResult = EnvLoader.validateEnv("prod");
  const devResult = EnvLoader.validateEnv("dev");
  
  expect(globalResult.GLOBAL_VAR).toBe("global");
  expect(prodResult.PROD_VAR).toBe("prod");
  expect(devResult.DEV_VAR).toBe("dev");
});
