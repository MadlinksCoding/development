const fs = require('fs');
const path = require('path');

// Dynamically load ErrorHandler implementation from config to avoid static paths
const CONFIG_PATH = path.resolve(__dirname, '..', 'test-runner.config.js');
let ErrorHandler;
try {
  const cfg = require(CONFIG_PATH);
  const cls = cfg.classes.find((c) => c.name === 'ErrorHandler');
  if (!cls) throw new Error('ErrorHandler not found in config');
  ErrorHandler = require(path.resolve(cfg.rootDir, cls.src));
} catch (err) {
  // fallback
  throw new Error(`Failed to load ErrorHandler class: ${err.message}`);
}

/**
 * --------------------------------
 * SECTION: ADD_ERROR TESTS
 * --------------------------------
 */

/**
 * Tests adding an error with both a message and data object.
 * Ensures the error entry includes message, data, and timestamp.
 */
test("PASS_add_error_1: Adds error with message and data", () => {
  ErrorHandler.clear();
  ErrorHandler.addError("Error occurred", { code: 500 });
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  // ErrorHandler may add additional properties, so check only the expected ones
  expect(errors[0].message).toBe("Error occurred");
  expect(errors[0].data).toEqual({ code: 500 });
  expect(errors[0].timestamp).toBeDefined();
  expect(typeof errors[0].timestamp).toBe('string');
});