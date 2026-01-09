const fs = require('fs');
const path = require('path');

// Dynamically load ConfigFileLoader and dependencies from config
const CONFIG_PATH = path.resolve(__dirname, '..', 'test-runner.config.js');
let ConfigFileLoader;
let ErrorHandler;
let Logger;
try {
  const cfg = require(CONFIG_PATH);
  
  const configCls = cfg.classes.find((c) => c.name === 'ConfigFileLoader');
  if (configCls) {
    ConfigFileLoader = require(path.resolve(cfg.rootDir, configCls.src));
  } else {
    ConfigFileLoader = require(path.resolve(cfg.rootDir, 'src', 'utils', 'ConfigFileLoader'));
  }
  
  const errorCls = cfg.classes.find((c) => c.name === 'ErrorHandler');
  if (errorCls) {
    ErrorHandler = require(path.resolve(cfg.rootDir, errorCls.src));
  } else {
    ErrorHandler = require(path.resolve(cfg.rootDir, 'src', 'utils', 'ErrorHandler'));
  }
  
  // Logger is optional - ConfigFileLoader handles it conditionally
  try {
    const loggerCls = cfg.classes.find((c) => c.name === 'Logger');
    if (loggerCls) {
      Logger = require(path.resolve(cfg.rootDir, loggerCls.src));
    } else {
      Logger = require(path.resolve(cfg.rootDir, 'src', 'utils', 'Logger'));
    }
  } catch (loggerErr) {
    // Logger is optional - set to null if it can't be loaded
    Logger = null;
  }
} catch (err) {
  throw new Error(`Failed to load classes: ${err.message}`);
}

// Helper to create test config files
const createTestConfigFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
};

// Helper to cleanup test files
const cleanupTestFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    // Ignore cleanup errors
  }
};

// Helper to clear cache
const clearConfigCache = () => {
  // Access private cache via reflection (for testing only)
  if (ConfigFileLoader._clearCache) {
    ConfigFileLoader._clearCache();
  }
};

/**
 * --------------------------------
 * SECTION: loadConfig() TESTS
 * --------------------------------
 */

/**
 * PASS_loadConfig_1: Valid relative path loads successfully
 */
test("PASS_loadConfig_1: Valid relative path loads successfully", () => {
  const configPath = path.join(process.cwd(), 'test-config-1.json');
  const testConfig = { app: { name: "TestApp", version: "1.0.0" } };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result).toEqual(testConfig);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.app)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_2: Cache hit returns same frozen object
 */
test("PASS_loadConfig_2: Cache hit returns same frozen object", () => {
  const configPath = path.join(process.cwd(), 'test-config-2.json');
  const testConfig = { cache: "test" };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result1 = ConfigFileLoader.loadConfig(relativePath);
    const result2 = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result1).toBe(result2); // Same object reference
    expect(Object.isFrozen(result1)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_3: Cache miss when file changes
 */
test("PASS_loadConfig_3: Cache miss when file changes", () => {
  const configPath = path.join(process.cwd(), 'test-config-3.json');
  const testConfig1 = { version: "1.0.0" };
  const testConfig2 = { version: "2.0.0" };
  
  createTestConfigFile(configPath, testConfig1);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result1 = ConfigFileLoader.loadConfig(relativePath);
    
    // Wait a bit to ensure mtime changes
    const wait = new Promise(resolve => setTimeout(resolve, 10));
    return wait.then(() => {
      createTestConfigFile(configPath, testConfig2);
      const result2 = ConfigFileLoader.loadConfig(relativePath);
      
      expect(result2.version).toBe("2.0.0");
      expect(result1).not.toBe(result2);
      
      cleanupTestFile(configPath);
    });
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_4: Deep freeze nested objects
 */
test("PASS_loadConfig_4: Deep freeze nested objects", () => {
  const configPath = path.join(process.cwd(), 'test-config-4.json');
  const testConfig = {
    level1: {
      level2: {
        level3: { value: "deep" }
      },
      array: [{ item: "test" }]
    }
  };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.level1)).toBe(true);
    expect(Object.isFrozen(result.level1.level2)).toBe(true);
    expect(Object.isFrozen(result.level1.level2.level3)).toBe(true);
    expect(Object.isFrozen(result.level1.array)).toBe(true);
    expect(Object.isFrozen(result.level1.array[0])).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_5: JSON array root loads successfully
 */
test("PASS_loadConfig_5: JSON array root loads successfully", () => {
  const configPath = path.join(process.cwd(), 'test-config-5.json');
  const testConfig = [{ id: 1, name: "Item1" }, { id: 2, name: "Item2" }];
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_6: Path with ./ segments normalizes correctly
 */
test("PASS_loadConfig_6: Path with ./ segments normalizes correctly", () => {
  const configPath = path.join(process.cwd(), 'test-config-6.json');
  const testConfig = { normalized: true };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = `./${path.relative(process.cwd(), configPath)}`;
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result).toEqual(testConfig);
    expect(Object.isFrozen(result)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_7: Path with ../ segments inside project root works
 */
test("PASS_loadConfig_7: Path with ../ segments inside project root works", () => {
  const subDir = path.join(process.cwd(), 'test-subdir');
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }
  
  const configPath = path.join(process.cwd(), 'test-config-7.json');
  const testConfig = { subdir: true };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = `test-subdir/../test-config-7.json`;
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result).toEqual(testConfig);
    
    cleanupTestFile(configPath);
    try { fs.rmdirSync(subDir); } catch {}
  } catch (err) {
    cleanupTestFile(configPath);
    try { fs.rmdirSync(subDir); } catch {}
    throw err;
  }
});

/**
 * PASS_loadConfig_8: Case-insensitive .json extension check
 */
test("PASS_loadConfig_8: Case-insensitive .json extension check", () => {
  const configPath = path.join(process.cwd(), 'test-config-8.JSON');
  const testConfig = { case: "insensitive" };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result).toEqual(testConfig);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_9: Empty object {} loads successfully
 */
test("PASS_loadConfig_9: Empty object {} loads successfully", () => {
  const configPath = path.join(process.cwd(), 'test-config-9.json');
  const testConfig = {};
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result).toEqual({});
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result).length).toBe(0);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_10: Atomic read retries once due to detected change, then succeeds
 */
test("PASS_loadConfig_10: Atomic read retries once then succeeds", () => {
  const configPath = path.join(process.cwd(), 'test-config-10.json');
  const testConfig = { atomic: "test" };
  createTestConfigFile(configPath, testConfig);
  
  const originalStatSync = fs.statSync;
  let callCount = 0;
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    // Mock fs.statSync to simulate file change on first read
    fs.statSync = jest.fn((filePath) => {
      callCount++;
      const stats = originalStatSync(filePath);
      if (callCount === 2) {
        // Second stat - after read, simulate change
        return {
          ...stats,
          mtimeMs: stats.mtimeMs + 1000, // Simulate change
        };
      }
      // First and subsequent stats - stable
      return stats;
    });
    
    const result = ConfigFileLoader.loadConfig(relativePath);
    expect(result).toEqual(testConfig);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  } finally {
    fs.statSync = originalStatSync;
  }
});

/**
 * PASS_loadConfig_11: Atomic read retries twice, succeeds on 3rd attempt
 */
test("PASS_loadConfig_11: Atomic read retries twice, succeeds on 3rd", () => {
  const configPath = path.join(process.cwd(), 'test-config-11.json');
  const testConfig = { atomic: "retry" };
  createTestConfigFile(configPath, testConfig);
  
  const originalStatSync = fs.statSync;
  let callCount = 0;
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    fs.statSync = jest.fn((filePath) => {
      callCount++;
      const stats = originalStatSync(filePath);
      if (callCount === 2 || callCount === 4) {
        // Second and fourth stats (after reads) show changes
        return {
          ...stats,
          mtimeMs: stats.mtimeMs + callCount * 1000,
        };
      }
      return stats; // Stable on 3rd attempt
    });
    
    const result = ConfigFileLoader.loadConfig(relativePath);
    expect(result).toEqual(testConfig);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  } finally {
    fs.statSync = originalStatSync;
  }
});

/**
 * PASS_loadConfig_12: Mixed slashes normalize correctly
 */
test("PASS_loadConfig_12: Mixed slashes normalize correctly", () => {
  const configPath = path.join(process.cwd(), 'test-config-12.json');
  const testConfig = { mixed: "slashes" };
  createTestConfigFile(configPath, testConfig);
  
  try {
    // Use mixed slashes
    const relativePath = path.relative(process.cwd(), configPath).replace(/\\/g, '/');
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result).toEqual(testConfig);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_13: Nested arrays of objects deep-freeze correctly
 */
test("PASS_loadConfig_13: Nested arrays of objects deep-freeze", () => {
  const configPath = path.join(process.cwd(), 'test-config-13.json');
  const testConfig = {
    items: [
      { id: 1, nested: { value: "a" } },
      { id: 2, nested: { value: "b" } }
    ]
  };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items)).toBe(true);
    expect(Object.isFrozen(result.items[0])).toBe(true);
    expect(Object.isFrozen(result.items[0].nested)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_14: Cache hit with different raw input (leading slashes)
 */
test("PASS_loadConfig_14: Cache hit with different raw input", () => {
  const configPath = path.join(process.cwd(), 'test-config-14.json');
  const testConfig = { cached: true };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result1 = ConfigFileLoader.loadConfig(relativePath);
    const result2 = ConfigFileLoader.loadConfig(`////${relativePath}`);
    
    expect(result1).toBe(result2); // Same cached object
    expect(Object.isFrozen(result1)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_loadConfig_15: Empty object {} returns frozen empty object
 */
test("PASS_loadConfig_15: Empty object returns frozen empty object", () => {
  const configPath = path.join(process.cwd(), 'test-config-15.json');
  const testConfig = {};
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(result).toEqual({});
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result).length).toBe(0);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * FAIL_loadConfig_1: Missing/falsy path throws INVALID_FILE_PATH
 */
test("FAIL_loadConfig_1: Missing path throws INVALID_FILE_PATH", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.loadConfig(null)).toThrow("requires a file path string");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_PATH");
  expect(error).toBeDefined();
  expect(error.data.origin).toBe("ConfigSchemaLoader");
});

/**
 * FAIL_loadConfig_2: Non-string path throws INVALID_FILE_PATH
 */
test("FAIL_loadConfig_2: Non-string path throws INVALID_FILE_PATH", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.loadConfig(123)).toThrow("requires a file path string");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_PATH");
  expect(error).toBeDefined();
});

/**
 * FAIL_loadConfig_3: Empty string after sanitization throws
 */
test("FAIL_loadConfig_3: Empty string after sanitization throws", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.loadConfig("   ")).toThrow("Config file path cannot be empty");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_NAME");
  expect(error).toBeDefined();
});

/**
 * FAIL_loadConfig_4: Null byte throws INVALID_FILE_NAME
 */
test("FAIL_loadConfig_4: Null byte throws INVALID_FILE_NAME", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.loadConfig("config\0.json")).toThrow("cannot contain null bytes");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_NAME");
  expect(error).toBeDefined();
});

/**
 * FAIL_loadConfig_5: Non-.json extension throws INVALID_FILE_EXT
 */
test("FAIL_loadConfig_5: Non-.json extension throws INVALID_FILE_EXT", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.loadConfig("config.txt")).toThrow("must be .json");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_EXT");
  expect(error).toBeDefined();
});

/**
 * FAIL_loadConfig_6: File not found throws FILE_NOT_FOUND
 */
test("FAIL_loadConfig_6: File not found throws FILE_NOT_FOUND", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.loadConfig("nonexistent.json")).toThrow("Config file not found");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "FILE_NOT_FOUND");
  expect(error).toBeDefined();
  expect(error.data.origin).toBe("ConfigSchemaLoader");
});

/**
 * FAIL_loadConfig_7: Directory instead of file throws NOT_A_FILE
 */
test("FAIL_loadConfig_7: Directory throws NOT_A_FILE", () => {
  const dirPath = path.join(process.cwd(), 'test-dir');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  ErrorHandler.clear();
  
  try {
    const relativePath = path.relative(process.cwd(), dirPath);
    expect(() => ConfigFileLoader.loadConfig(`${relativePath}.json`)).toThrow("is not a file");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "NOT_A_FILE");
    expect(error).toBeDefined();
  } finally {
    try { fs.rmdirSync(dirPath); } catch {}
  }
});

/**
 * FAIL_loadConfig_8: Path traversal throws PATH_TRAVERSAL_BLOCKED
 */
test("FAIL_loadConfig_8: Path traversal throws PATH_TRAVERSAL_BLOCKED", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.loadConfig("../secrets.json")).toThrow("Blocked path traversal attempt");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "PATH_TRAVERSAL_BLOCKED");
  expect(error).toBeDefined();
  expect(error.data.origin).toBe("ConfigSchemaLoader");
});

/**
 * FAIL_loadConfig_9: Non-string content throws INVALID_CONTENT
 */
test("FAIL_loadConfig_9: Non-string content throws INVALID_CONTENT", () => {
  const configPath = path.join(process.cwd(), 'test-config-invalid.json');
  createTestConfigFile(configPath, {});
  
  const originalReadFileSync = fs.readFileSync;
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    // Mock readFileSync to return non-string
    fs.readFileSync = jest.fn(() => Buffer.from("{}"));
    
    ErrorHandler.clear();
    expect(() => ConfigFileLoader.loadConfig(relativePath)).toThrow("Invalid config content");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "INVALID_CONTENT");
    expect(error).toBeDefined();
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

/**
 * FAIL_loadConfig_10: Content doesn't look like JSON throws INVALID_JSON_SYNTAX
 */
test("FAIL_loadConfig_10: Non-JSON content throws INVALID_JSON_SYNTAX", () => {
  const configPath = path.join(process.cwd(), 'test-config-notjson.json');
  fs.writeFileSync(configPath, "not json content", 'utf8');
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    ErrorHandler.clear();
    expect(() => ConfigFileLoader.loadConfig(relativePath)).toThrow("does not look like JSON");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "INVALID_JSON_SYNTAX");
    expect(error).toBeDefined();
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * FAIL_loadConfig_11: Invalid JSON parse throws INVALID_JSON_SYNTAX
 */
test("FAIL_loadConfig_11: Invalid JSON parse throws INVALID_JSON_SYNTAX", () => {
  const configPath = path.join(process.cwd(), 'test-config-badjson.json');
  fs.writeFileSync(configPath, '{"invalid": json}', 'utf8');
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    ErrorHandler.clear();
    expect(() => ConfigFileLoader.loadConfig(relativePath)).toThrow("Invalid JSON syntax");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "INVALID_JSON_SYNTAX");
    expect(error).toBeDefined();
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * FAIL_loadConfig_12: Atomic read fails after 3 attempts throws ATOMIC_READ_FAILED
 */
test("FAIL_loadConfig_12: Atomic read fails after 3 attempts", () => {
  const configPath = path.join(process.cwd(), 'test-config-atomic.json');
  createTestConfigFile(configPath, { test: true });
  
  const originalStatSync = fs.statSync;
  let callCount = 0;
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    // Mock statSync to always show changes after reads
    fs.statSync = jest.fn((filePath) => {
      callCount++;
      const stats = originalStatSync(filePath);
      // Always show change after read (even numbered calls)
      if (callCount % 2 === 0) {
        return {
          ...stats,
          mtimeMs: stats.mtimeMs + callCount * 1000,
        };
      }
      return stats;
    });
    
    ErrorHandler.clear();
    expect(() => ConfigFileLoader.loadConfig(relativePath)).toThrow("atomic read failed after retries");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "ATOMIC_READ_FAILED");
    expect(error).toBeDefined();
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  } finally {
    fs.statSync = originalStatSync;
  }
});

/**
 * FAIL_loadConfig_13: Empty string while size > 0 throws ATOMIC_READ_FAILED
 */
test("FAIL_loadConfig_13: Empty string with size > 0 throws ATOMIC_READ_FAILED", () => {
  const configPath = path.join(process.cwd(), 'test-config-empty.json');
  createTestConfigFile(configPath, { test: true });
  
  const originalReadFileSync = fs.readFileSync;
  let readCount = 0;
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    // Mock readFileSync to return empty string while stat shows size > 0
    fs.readFileSync = jest.fn((filePath, encoding) => {
      readCount++;
      if (readCount <= 3) {
        return ""; // Empty string
      }
      return originalReadFileSync(filePath, encoding);
    });
    
    ErrorHandler.clear();
    expect(() => ConfigFileLoader.loadConfig(relativePath)).toThrow("atomic read failed");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "ATOMIC_READ_FAILED");
    expect(error).toBeDefined();
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

/**
 * --------------------------------
 * SECTION: load() TESTS
 * --------------------------------
 */

/**
 * PASS_load_1: Valid relative path loads successfully
 */
test("PASS_load_1: Valid relative path loads successfully", () => {
  const configPath = path.join(process.cwd(), 'test-load-1.json');
  const testConfig = { load: "test" };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const result = ConfigFileLoader.load(configPath);
    
    expect(result).toEqual(testConfig);
    expect(Object.isFrozen(result)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_load_2: Valid absolute path loads successfully
 */
test("PASS_load_2: Valid absolute path loads successfully", () => {
  const configPath = path.join(process.cwd(), 'test-load-2.json');
  const testConfig = { absolute: true };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const absolutePath = path.resolve(configPath);
    const result = ConfigFileLoader.load(absolutePath);
    
    expect(result).toEqual(testConfig);
    expect(Object.isFrozen(result)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_load_3: JSON array root loads successfully
 */
test("PASS_load_3: JSON array root loads successfully", () => {
  const configPath = path.join(process.cwd(), 'test-load-3.json');
  const testConfig = [1, 2, 3];
  createTestConfigFile(configPath, testConfig);
  
  try {
    const result = ConfigFileLoader.load(configPath);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
    expect(Object.isFrozen(result)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_load_4: Nested objects/arrays deep-frozen recursively
 */
test("PASS_load_4: Nested objects/arrays deep-frozen", () => {
  const configPath = path.join(process.cwd(), 'test-load-4.json');
  const testConfig = {
    nested: {
      array: [{ deep: { value: "test" } }]
    }
  };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const result = ConfigFileLoader.load(configPath);
    
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nested)).toBe(true);
    expect(Object.isFrozen(result.nested.array)).toBe(true);
    expect(Object.isFrozen(result.nested.array[0])).toBe(true);
    expect(Object.isFrozen(result.nested.array[0].deep)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_load_5: Path with ./ segments normalizes fine
 */
test("PASS_load_5: Path with ./ segments normalizes", () => {
  const configPath = path.join(process.cwd(), 'test-load-5.json');
  const testConfig = { normalized: true };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const normalizedPath = `./${path.basename(configPath)}`;
    const result = ConfigFileLoader.load(normalizedPath);
    
    expect(result).toEqual(testConfig);
    expect(Object.isFrozen(result)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * FAIL_load_1: Missing/falsy path throws INVALID_FILE_PATH
 */
test("FAIL_load_1: Missing path throws INVALID_FILE_PATH", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.load(null)).toThrow("requires a file path string");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_PATH");
  expect(error).toBeDefined();
});

/**
 * FAIL_load_2: Non-string path throws INVALID_FILE_PATH
 */
test("FAIL_load_2: Non-string path throws INVALID_FILE_PATH", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.load(123)).toThrow("requires a file path string");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_PATH");
  expect(error).toBeDefined();
});

/**
 * FAIL_load_3: Empty string after sanitization throws
 */
test("FAIL_load_3: Empty string after sanitization throws", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.load("   ")).toThrow("requires a non-empty path string");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "INVALID_FILE_PATH");
  expect(error).toBeDefined();
});

/**
 * FAIL_load_4: File not found throws FILE_NOT_FOUND
 */
test("FAIL_load_4: File not found throws FILE_NOT_FOUND", () => {
  ErrorHandler.clear();
  
  expect(() => ConfigFileLoader.load("nonexistent.json")).toThrow("Config file not found");
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "FILE_NOT_FOUND");
  expect(error).toBeDefined();
});

/**
 * FAIL_load_5: Directory throws NOT_A_FILE
 */
test("FAIL_load_5: Directory throws NOT_A_FILE", () => {
  const dirPath = path.join(process.cwd(), 'test-load-dir');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  ErrorHandler.clear();
  
  try {
    expect(() => ConfigFileLoader.load(dirPath)).toThrow("is not a file");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "NOT_A_FILE");
    expect(error).toBeDefined();
  } finally {
    try { fs.rmdirSync(dirPath); } catch {}
  }
});

/**
 * FAIL_load_6: Non-JSON-like content throws INVALID_JSON_SYNTAX
 */
test("FAIL_load_6: Non-JSON-like content throws INVALID_JSON_SYNTAX", () => {
  const configPath = path.join(process.cwd(), 'test-load-notjson.json');
  fs.writeFileSync(configPath, "not json", 'utf8');
  
  try {
    ErrorHandler.clear();
    expect(() => ConfigFileLoader.load(configPath)).toThrow("does not look like JSON");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "INVALID_JSON_SYNTAX");
    expect(error).toBeDefined();
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * FAIL_load_7: Invalid JSON parse throws INVALID_JSON_SYNTAX
 */
test("FAIL_load_7: Invalid JSON parse throws INVALID_JSON_SYNTAX", () => {
  const configPath = path.join(process.cwd(), 'test-load-badjson.json');
  fs.writeFileSync(configPath, '{"invalid": json}', 'utf8');
  
  try {
    ErrorHandler.clear();
    expect(() => ConfigFileLoader.load(configPath)).toThrow("Invalid JSON syntax");
    
    const errors = ErrorHandler.getAllErrors();
    const error = errors.find(e => e.data && e.data.code === "INVALID_JSON_SYNTAX");
    expect(error).toBeDefined();
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * --------------------------------
 * SECTION: LOGGER INTEGRATION TESTS
 * --------------------------------
 */

/**
 * PASS_logger_1: Logger integration on successful load
 */
test("PASS_logger_1: Logger integration on successful load", () => {
  const configPath = path.join(process.cwd(), 'test-logger-1.json');
  const testConfig = { logger: "test" };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    if (Logger && typeof Logger.writeLog === "function") {
      const writeLogSpy = jest.spyOn(Logger, 'writeLog');
      ErrorHandler.clear();
      
      ConfigFileLoader.loadConfig(relativePath);
      
      // Check if Logger.writeLog was called
      const logCalls = writeLogSpy.mock.calls.filter(call => 
        call[1] === "config" && (call[2] === "loaded" || call[2] === "cache_hit")
      );
      expect(logCalls.length).toBeGreaterThan(0);
      
      writeLogSpy.mockRestore();
    }
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_logger_2: Logger integration on error
 */
test("PASS_logger_2: Logger integration on error", () => {
  if (Logger && typeof Logger.writeLog === "function") {
    const writeLogSpy = jest.spyOn(Logger, 'writeLog');
    ErrorHandler.clear();
    
    try {
      ConfigFileLoader.loadConfig("nonexistent.json");
    } catch (err) {
      // Expected
    }
    
    // Check if Logger.writeLog was called for error
    const logCalls = writeLogSpy.mock.calls.filter(call => 
      call[1] === "config" && call[2] === "file_not_found"
    );
    expect(logCalls.length).toBeGreaterThan(0);
    
    writeLogSpy.mockRestore();
  }
});

/**
 * PASS_logger_3: Logger integration on cache hit
 */
test("PASS_logger_3: Logger integration on cache hit", () => {
  const configPath = path.join(process.cwd(), 'test-logger-3.json');
  const testConfig = { cached: true };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    if (Logger && typeof Logger.writeLog === "function") {
      const writeLogSpy = jest.spyOn(Logger, 'writeLog');
      
      // First load
      ConfigFileLoader.loadConfig(relativePath);
      // Second load (cache hit)
      ConfigFileLoader.loadConfig(relativePath);
      
      // Check for cache hit log
      const cacheHitCalls = writeLogSpy.mock.calls.filter(call => 
        call[1] === "config" && call[2] === "cache_hit"
      );
      expect(cacheHitCalls.length).toBeGreaterThan(0);
      
      writeLogSpy.mockRestore();
    }
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});


/**
 * --------------------------------
 * SECTION: PRIVATE METHOD COVERAGE TESTS
 * --------------------------------
 */

/**
 * PASS_private*1: #sanitizeConfigPath() handles leading separators
 */
test("PASS_private*1: sanitizeConfigPath handles leading separators", () => {
  const configPath = path.join(process.cwd(), 'test-private-1.json');
  const testConfig = { test: true };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    // Test with leading slashes
    const result1 = ConfigFileLoader.loadConfig("/" + relativePath);
    const result2 = ConfigFileLoader.loadConfig("//" + relativePath);
    const result3 = ConfigFileLoader.loadConfig("\\\\" + relativePath);
    
    expect(result1).toEqual(testConfig);
    expect(result2).toEqual(testConfig);
    expect(result3).toEqual(testConfig);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_private*2: #parseJsonStrict() handles array root
 */
test("PASS_private*2: parseJsonStrict handles array root", () => {
  const configPath = path.join(process.cwd(), 'test-private-2.json');
  const testConfig = [1, 2, 3, { nested: true }];
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[3])).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_private*3: #deepFreeze() handles nested arrays deeply
 */
test("PASS_private*3: deepFreeze handles nested arrays deeply", () => {
  const configPath = path.join(process.cwd(), 'test-private-3.json');
  const testConfig = {
    nested: {
      arrays: [
        [{ deep: { value: 1 } }],
        [{ deep: { value: 2 } }]
      ]
    }
  };
  createTestConfigFile(configPath, testConfig);
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    const result = ConfigFileLoader.loadConfig(relativePath);
    
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nested)).toBe(true);
    expect(Object.isFrozen(result.nested.arrays)).toBe(true);
    expect(Object.isFrozen(result.nested.arrays[0])).toBe(true);
    expect(Object.isFrozen(result.nested.arrays[0][0])).toBe(true);
    expect(Object.isFrozen(result.nested.arrays[0][0].deep)).toBe(true);
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  }
});

/**
 * PASS_private*4: #atomicReadFile() handles file size changes
 */
test("PASS_private*4: atomicReadFile handles file size changes", () => {
  const configPath = path.join(process.cwd(), 'test-private-4.json');
  createTestConfigFile(configPath, { test: true });
  
  const originalStatSync = fs.statSync;
  let callCount = 0;
  
  try {
    const relativePath = path.relative(process.cwd(), configPath);
    
    // Mock statSync to show size change
    fs.statSync = jest.fn((filePath) => {
      callCount++;
      const stats = originalStatSync(filePath);
      if (callCount === 2) {
        // After read, simulate size change
        return {
          ...stats,
          size: stats.size + 100,
        };
      }
      return stats;
    });
    
    // Should retry and succeed
    const result = ConfigFileLoader.loadConfig(relativePath);
    expect(result).toEqual({ test: true });
    
    cleanupTestFile(configPath);
  } catch (err) {
    cleanupTestFile(configPath);
    throw err;
  } finally {
    fs.statSync = originalStatSync;
  }
});

/**
 * PASS_private*5: #resolveInBaseDir() blocks path traversal
 */
test("PASS_private*5: resolveInBaseDir blocks path traversal", () => {
  ErrorHandler.clear();
  
  // Path that normalizes to contain ..
  expect(() => ConfigFileLoader.loadConfig("configs/../../secrets.json")).toThrow();
  
  const errors = ErrorHandler.getAllErrors();
  const error = errors.find(e => e.data && e.data.code === "PATH_TRAVERSAL_BLOCKED");
  expect(error).toBeDefined();
});