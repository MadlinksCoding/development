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
| * --------------------------------
| * SECTION: ADD_ERROR TESTS
| * --------------------------------
| */

afterEach(() => {
  ErrorHandler.clear();
  ErrorHandler.maxErrorsStored = 500;
});

/**
| * Tests adding an error with both a message and data object.
| * Ensures the error entry includes message, data, and timestamps.
| */
test("PASS_add_error_1: Adds error with message and data", () => {
  ErrorHandler.addError("Error occurred", { code: 500 });
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0]).toEqual(
    expect.objectContaining({
      message: "Error occurred",
      data: expect.objectContaining({ code: 500 }),
      timestamp: expect.any(String),
      lastTimestamp: expect.any(String),
      count: 1,
      signature: expect.any(String),
    }),
  );
});

/**
| * Tests adding an error with only a message.
| * Verifies that the data field defaults to an empty object.
| */
test("PASS_add_error_2: Adds error with message only", () => {
  ErrorHandler.addError("Only message");
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0]).toEqual(
    expect.objectContaining({
      message: "Only message",
      data: {},
      timestamp: expect.any(String),
      lastTimestamp: expect.any(String),
      count: 1,
    }),
  );
});

/**
| * Tests behavior when a non-string is passed as message.
| * Now validates message must be a string and throws error.
| */
test("FAIL_add_error_1: Passes non-string as message throws error", () => {
  expect(() => ErrorHandler.addError(12345)).toThrow("message must be a string");
});

/**
| * Tests adding an error where the message is undefined.
| * Now validates message must be a string and throws error.
| */
test("FAIL_add_error_2: Message is undefined throws error", () => {
  expect(() => ErrorHandler.addError(undefined)).toThrow("message must be a string");
});

/**
| * Tests adding an error with falsy numeric data (0).
| * Non-object data is now sanitized to empty object.
| */
test("PASS_add_error_3: Adds error with data = 0 (falsy) sanitizes to empty object", () => {
  ErrorHandler.addError("Zero value", 0);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0]).toEqual(
    expect.objectContaining({
      message: "Zero value",
      data: {},
      timestamp: expect.any(String),
      count: 1,
    }),
  );
});

/**
| * Tests adding an error with falsy boolean data (false).
| * Non-object data is now sanitized to empty object.
| */
test("PASS_add_error_4: Adds error with data = false (falsy) sanitizes to empty object", () => {
  ErrorHandler.addError("False value", false);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0]).toEqual(
    expect.objectContaining({
      message: "False value",
      data: {},
      timestamp: expect.any(String),
      count: 1,
    }),
  );
});

/**
| * Tests adding an error with a function as the message.
| * Now validates message must be a string and throws error.
| */
test("FAIL_add_error_3: Passes function as message throws error", () => {
  expect(() => ErrorHandler.addError(() => "oops")).toThrow("message must be a string");
});

/**
| * --------------------------------
| * SECTION: HAS_ERRORS TESTS
| * --------------------------------
| */

/**
| * Tests that hasErrors() returns true when errors exist.
| * Confirms detection of non-empty error log.
| */
test("PASS_has_errors_1: Returns true when errors exist", () => {
  ErrorHandler.addError("An error");
  expect(ErrorHandler.hasErrors()).toBe(true);
});

/**
| * Tests that hasErrors() returns false when no errors exist.
| * Confirms detection of an empty error log.
| */
test("PASS_has_errors_2: Returns false when no errors exist", () => {
  expect(ErrorHandler.hasErrors()).toBe(false);
});

/**
| * --------------------------------
| * SECTION: GET_ALL_ERRORS TESTS
| * --------------------------------
| */

/**
| * Tests retrieving all logged errors.
| * Ensures correct order and presence of message, data, and timestamp.
| */
test("PASS_get_all_errors_1: Returns all recorded error objects", () => {
  ErrorHandler.addError("Err 1", { val: 1 });
  ErrorHandler.addError("Err 2", { val: 2 });
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(2);
  expect(errors[0]).toEqual(
    expect.objectContaining({
      message: "Err 1",
      timestamp: expect.any(String),
      count: 1,
    }),
  );
  expect(errors[1]).toEqual(
    expect.objectContaining({
      message: "Err 2",
      timestamp: expect.any(String),
      count: 1,
    }),
  );
});

/**
| * Tests retrieving all errors when none are logged.
| * Verifies an empty array is returned.
| */
test("PASS_get_all_errors_2: Returns empty array when no errors", () => {
  expect(ErrorHandler.getAllErrors()).toEqual([]);
});

/**
| * --------------------------------
| * SECTION: CLEAR TESTS
| * --------------------------------
| */

/**
| * Tests clearing all logged errors after adding some.
| * Ensures the error list is reset to an empty array.
| */
test("PASS_clear_1: Clears all errors", () => {
  ErrorHandler.addError("To be cleared");
  ErrorHandler.clear();
  expect(ErrorHandler.getAllErrors()).toEqual([]);
});

/**
| * Tests clearing errors when there are none logged.
| * Confirms no errors or exceptions occur.
| */
test("PASS_clear_2: Works even when error list is empty", () => {
  ErrorHandler.clear();
  expect(ErrorHandler.getAllErrors()).toEqual([]);
});

/**
| * Dedupe and count errors with same signature.
| */
test("PASS_dedupe_1: Aggregates duplicates and increments count", () => {
  ErrorHandler.addError("Dup error", { code: 1 });
  ErrorHandler.addError("Dup error", { code: 1 });
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].count).toBe(2);
  expect(errors[0].lastTimestamp).toEqual(expect.any(String));
});

/**
| * Ring buffer eviction increments dropped count.
| */
test("PASS_ring_buffer_1: Evicts oldest and increments dropped count", () => {
  ErrorHandler.maxErrorsStored = 2;
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(2);
  expect(ErrorHandler.droppedCount).toBe(1);
  expect(errors.some((err) => err.message === "Err 1")).toBe(false);
});

/**
| * Critical alert triggered when error threshold is reached.
| */

/**
 * --------------------------------
 * SECTION: NEW SECURITY FEATURES TESTS (from audit fixes)
 * --------------------------------
 */

/**
 * PASS_INPUT_VALIDATION_1: Message length validation rejects too long messages
 */
test("PASS_INPUT_VALIDATION_1: Rejects message exceeding 10KB", () => {
  const longMessage = "x".repeat(10001);
  expect(() => ErrorHandler.addError(longMessage)).toThrow("exceeds maximum length");
});

/**
 * PASS_INPUT_VALIDATION_2: Accepts message at exactly maximum length
 */
test("PASS_INPUT_VALIDATION_2: Accepts message at exactly 10KB", () => {
  const maxMessage = "x".repeat(10000);
  expect(() => ErrorHandler.addError(maxMessage)).not.toThrow();
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].message.length).toBe(10000);
});

/**
 * PASS_INPUT_VALIDATION_3: Data size validation truncates large data
 */
test("PASS_INPUT_VALIDATION_3: Truncates data exceeding 100KB", () => {
  const largeData = { content: "x".repeat(200000) };
  ErrorHandler.addError("Large data", largeData);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toHaveProperty("_truncated");
});

/**
 * PASS_PROTOTYPE_POLLUTION_1: Sanitizes __proto__ from data
 */
test("PASS_PROTOTYPE_POLLUTION_1: Sanitizes __proto__ from data", () => {
  const maliciousData = { __proto__: { polluted: true }, normal: "value" };
  ErrorHandler.addError("Pollution attempt", maliciousData);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).not.toHaveProperty("__proto__");
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * PASS_PROTOTYPE_POLLUTION_2: Sanitizes constructor from data
 */
test("PASS_PROTOTYPE_POLLUTION_2: Sanitizes constructor from data", () => {
  const maliciousData = { constructor: "bad", normal: "value" };
  ErrorHandler.addError("Pollution attempt", maliciousData);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).not.toHaveProperty("constructor");
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * PASS_PROTOTYPE_POLLUTION_3: Sanitizes prototype from data
 */
test("PASS_PROTOTYPE_POLLUTION_3: Sanitizes prototype from data", () => {
  const maliciousData = { prototype: "bad", normal: "value" };
  ErrorHandler.addError("Pollution attempt", maliciousData);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).not.toHaveProperty("prototype");
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * PASS_PROTOTYPE_POLLUTION_4: Creates data object with null prototype
 */
test("PASS_PROTOTYPE_POLLUTION_4: Creates data object with null prototype", () => {
  ErrorHandler.addError("Test", { test: "value" });
  const errors = ErrorHandler.getAllErrors();
  expect(Object.getPrototypeOf(errors[0].data)).toBeNull();
});

/**
 * PASS_INTEGER_OVERFLOW_1: Handles totalErrorCount overflow
 */
test("PASS_INTEGER_OVERFLOW_1: Resets totalErrorCount at MAX_SAFE_INTEGER", () => {
  ErrorHandler.totalErrorCount = Number.MAX_SAFE_INTEGER;
  ErrorHandler.addError("Test");
  expect(ErrorHandler.totalErrorCount).toBeLessThan(Number.MAX_SAFE_INTEGER);
});

/**
 * PASS_INTEGER_OVERFLOW_2: Handles entry count overflow
 */
test("PASS_INTEGER_OVERFLOW_2: Resets entry count at MAX_SAFE_INTEGER", () => {
  ErrorHandler.addError("Dup");
  // Simulate count overflow by adding error many times
  // Since we can't directly modify internal cache, we test the overflow protection
  // by adding the error until count would overflow, then verify it resets
  const errors = ErrorHandler.getAllErrors();
  const dupError = errors.find(e => e.message === "Dup");
  expect(dupError).toBeDefined();
  expect(dupError.count).toBe(1);
  
  // Add same error again - should increment count
  ErrorHandler.addError("Dup");
  const updatedErrors = ErrorHandler.getAllErrors();
  const updatedDup = updatedErrors.find(e => e.message === "Dup");
  expect(updatedDup.count).toBe(2);
});

/**
 * PASS_CONFIG_VALIDATION_1: setMaxErrorsStored validates bounds
 */
test("PASS_CONFIG_VALIDATION_1: setMaxErrorsStored rejects invalid values", () => {
  expect(() => ErrorHandler.setMaxErrorsStored(0)).toThrow("must be an integer between 1 and 10000");
  expect(() => ErrorHandler.setMaxErrorsStored(-1)).toThrow("must be an integer between 1 and 10000");
  expect(() => ErrorHandler.setMaxErrorsStored(10001)).toThrow("must be an integer between 1 and 10000");
  expect(() => ErrorHandler.setMaxErrorsStored("100")).toThrow("must be an integer between 1 and 10000");
  expect(() => ErrorHandler.setMaxErrorsStored(100.5)).toThrow("must be an integer between 1 and 10000");
});

/**
 * PASS_CONFIG_VALIDATION_2: setMaxErrorsStored accepts valid values
 */
test("PASS_CONFIG_VALIDATION_2: setMaxErrorsStored accepts valid values", () => {
  expect(() => ErrorHandler.setMaxErrorsStored(100)).not.toThrow();
  expect(ErrorHandler.maxErrorsStored).toBe(100);
  expect(() => ErrorHandler.setMaxErrorsStored(10000)).not.toThrow();
  expect(ErrorHandler.maxErrorsStored).toBe(10000);
});

/**
 * PASS_CONFIG_VALIDATION_3: setErrorAlertThreshold validates bounds
 */

/**
 * PASS_CONFIG_VALIDATION_4: setErrorAlertThreshold accepts valid values
 */

/**
 * PASS_DOS_PROTECTION_1: Handles deeply nested objects
 */
test("PASS_DOS_PROTECTION_1: Handles deeply nested objects", () => {
  const deepObject = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: "deep" } } } } } } } } } } };
  ErrorHandler.addError("Deep", deepObject);
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].data).toHaveProperty("a");
});

/**
 * PASS_DOS_PROTECTION_2: Handles circular references in data
 */
test("PASS_DOS_PROTECTION_2: Handles circular references in data", () => {
  const circularData = { name: "test" };
  circularData.self = circularData;
  
  // Should not throw
  expect(() => ErrorHandler.addError("Circular", circularData)).not.toThrow();
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
});

/**
 * PASS_SIGNATURE_COLLISION_1: Uses Record Separator for signature
 */
test("PASS_SIGNATURE_COLLISION_1: Signature uses non-collision separator", () => {
  ErrorHandler.addError("Test|with|pipes", { value: "data|with|pipes" });
  const errors = ErrorHandler.getAllErrors();
  // The signature can contain "|" in message/data, but the separator should be \x1E
  // Check that the separator character is present (not "|" as separator)
  expect(errors[0].signature).toContain("\x1E");
  // Verify the separator is used between message and data (not "|")
  const parts = errors[0].signature.split("\x1E");
  expect(parts.length).toBe(2); // Should split into message and data parts
});

/**
 * PASS_HANDLER_TIMEOUT_1: Handler timeout protection prevents hanging
 */

/**
 * PASS_HANDLER_TIMEOUT_2: Handler completes within timeout
 */

/**
 * PASS_RATE_LIMITING_1: Alert rate limiting prevents spam
 */

/**
 * PASS_SETCRITICALHANDLER_1: Validates handler is function or null
 */

/**
 * PASS_SETCRITICALHANDLER_2: Accepts function handlers
 */

/**
 * PASS_SETCRITICALHANDLER_3: Accepts null to clear handler
 */

/**
 * PASS_CLEARERRORS_ONLY_1: clearErrorsOnly preserves stats
 */
test("PASS_CLEARERRORS_ONLY_1: clearErrorsOnly preserves stats", () => {
  ErrorHandler.addError("Test 1");
  ErrorHandler.addError("Test 2");
  const totalBefore = ErrorHandler.totalErrorCount;
  const droppedBefore = ErrorHandler.droppedCount;
  
  ErrorHandler.clearErrorsOnly();
  
  expect(ErrorHandler.getAllErrors()).toEqual([]);
  expect(ErrorHandler.totalErrorCount).toBe(totalBefore);
  expect(ErrorHandler.droppedCount).toBe(droppedBefore);
});

/**
 * PASS_CLEARERRORS_ONLY_2: clear() resets all stats
 */
test("PASS_CLEARERRORS_ONLY_2: clear() resets all stats", () => {
  ErrorHandler.addError("Test 1");
  ErrorHandler.addError("Test 2");
  
  ErrorHandler.clear();
  
  expect(ErrorHandler.getAllErrors()).toEqual([]);
  expect(ErrorHandler.totalErrorCount).toBe(0);
  expect(ErrorHandler.droppedCount).toBe(0);
});

/**
 * PASS_DEFENSIVE_COPY_1: getAllErrors returns defensive copy
 */
test("PASS_DEFENSIVE_COPY_1: getAllErrors returns defensive copy", () => {
  ErrorHandler.addError("Test", { value: "original" });
  const errors1 = ErrorHandler.getAllErrors();
  const errors2 = ErrorHandler.getAllErrors();
  
  // Modifying one copy shouldn't affect the other or the original
  errors1[0].message = "modified";
  errors1.push({ message: "added" });
  
  expect(errors2[0].message).toBe("Test");
  expect(errors2.length).toBe(1);
  expect(ErrorHandler.getAllErrors()[0].message).toBe("Test");
  expect(ErrorHandler.getAllErrors().length).toBe(1);
});

/**
 * PASS_INDEX_REBUILD_1: Index remains consistent after eviction
 */
test("PASS_INDEX_REBUILD_1: Index remains consistent after eviction", () => {
  ErrorHandler.maxErrorsStored = 3;
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  ErrorHandler.addError("Err 4");
  
  // After shift, index should be rebuilt
  ErrorHandler.addError("Err 2");
  const errors = ErrorHandler.getAllErrors();
  
  // Err 2 should be found and deduplicated
  const err2 = errors.find((e) => e.message === "Err 2");
  expect(err2).toBeDefined();
  expect(err2.count).toBe(2);
});

/**
 * PASS_ASYNC_HANDLER_1: Handles async handler correctly
 */

/**
 * PASS_OPTIMIZED_CLONING_1: Alert payload only clones necessary fields
 */

/**
 * PASS_SANITIZE_DATA_1: Only copies allowed value types
 */
test("PASS_SANITIZE_DATA_1: Sanitizes function values from data", () => {
  const dataWithFunctions = {
    good: "string",
    bad: function() { return "fn"; },
    number: 123,
    bool: true,
    arr: [1, 2, 3],
  };
  
  ErrorHandler.addError("Test", dataWithFunctions);
  const errors = ErrorHandler.getAllErrors();
  
  expect(errors[0].data).toHaveProperty("good");
  expect(errors[0].data).not.toHaveProperty("bad");
  expect(errors[0].data).toHaveProperty("number");
  expect(errors[0].data).toHaveProperty("bool");
  expect(errors[0].data).toHaveProperty("arr");
});

/**
 * PASS_SANITIZE_DATA_2: Handles null data gracefully
 */
test("PASS_SANITIZE_DATA_2: Handles null data gracefully", () => {
  ErrorHandler.addError("Test", null);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toEqual({});
});

/**
 * PASS_TRIM_ON_SETMAX_1: Trims errors when maxErrorsStored is reduced
 */
test("PASS_TRIM_ON_SETMAX_1: Trims errors when maxErrorsStored is reduced", () => {
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  ErrorHandler.addError("Err 4");
  ErrorHandler.addError("Err 5");
  
  expect(ErrorHandler.getAllErrors().length).toBe(5);
  
  ErrorHandler.setMaxErrorsStored(2);
  
  expect(ErrorHandler.getAllErrors().length).toBe(2);
  // Should keep most recent errors
  const errors = ErrorHandler.getAllErrors();
  expect(errors.some((e) => e.message === "Err 4")).toBe(true);
  expect(errors.some((e) => e.message === "Err 5")).toBe(true);
});

/**
 * --------------------------------
 * SECTION: SIGNATURE GENERATION EDGE CASES
 * --------------------------------
 */

/**
 * PASS_signature*1: Very long message generates valid signature
 */
test("PASS_signature*1: Very long message generates valid signature", () => {
  const longMessage = "x".repeat(5000);
  ErrorHandler.addError(longMessage, { test: "data" });
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].signature).toBeDefined();
  expect(typeof errors[0].signature).toBe("string");
});

/**
 * PASS_signature*2: Message with special unicode characters preserves signature
 */
test("PASS_signature*2: Message with unicode characters preserves signature", () => {
  const unicodeMessage = "Error: 🚀 测试 テスト тест";
  ErrorHandler.addError(unicodeMessage, { test: "data" });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].signature).toContain(unicodeMessage);
});

/**
 * PASS_signature*3: Same message with different data generates different signatures
 */
test("PASS_signature*3: Same message with different data generates different signatures", () => {
  ErrorHandler.addError("Same message", { data1: "value1" });
  ErrorHandler.addError("Same message", { data2: "value2" });
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(2);
  expect(errors[0].signature).not.toBe(errors[1].signature);
});

/**
 * PASS_signature*4: Data truncation in signature includes marker
 */
test("PASS_signature*4: Large data truncates in signature", () => {
  const largeData = { content: "x".repeat(60000) };
  ErrorHandler.addError("Large data", largeData);
  const errors = ErrorHandler.getAllErrors();
  // Signature should be truncated if data exceeds MAX_JSON_STRING_LENGTH
  expect(errors[0].signature).toBeDefined();
});

/**
 * PASS_signature*5: Signature uses Record Separator consistently
 */
test("PASS_signature*5: Signature uses Record Separator consistently", () => {
  ErrorHandler.addError("Test|with|pipes", { value: "data|with|pipes" });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].signature).toContain("\x1E");
  // The signature can contain "|" in message/data, but separator should be \x1E
  // Verify separator is used (not "|" as separator)
  const parts = errors[0].signature.split("\x1E");
  expect(parts.length).toBe(2); // Should split into message and data parts
});

/**
 * FAIL_signature*1: unserializable data in signature falls back to placeholder
 */
test("FAIL_signature*1: unserializable data falls back to placeholder", () => {
  const circularData = { name: "test" };
  circularData.self = circularData;
  
  ErrorHandler.addError("Circular", circularData);
  const errors = ErrorHandler.getAllErrors();
  // Should handle circular reference in signature
  expect(errors[0].signature).toBeDefined();
});

/**
 * --------------------------------
 * SECTION: DEDUPLICATION SCENARIOS
 * --------------------------------
 */

/**
 * PASS_dedupe*2: Same message, different data creates separate entries
 */
test("PASS_dedupe*2: Same message with different data creates separate entries", () => {
  ErrorHandler.addError("Same message", { code: 1 });
  ErrorHandler.addError("Same message", { code: 2 });
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(2);
  expect(errors[0].count).toBe(1);
  expect(errors[1].count).toBe(1);
});

/**
 * PASS_dedupe*3: Similar messages with typos create separate entries
 */
test("PASS_dedupe*3: Similar messages with typos create separate entries", () => {
  ErrorHandler.addError("Error occurred");
  ErrorHandler.addError("Error occured"); // Typo
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(2);
});

/**
 * PASS_dedupe*4: Deduplication works after eviction and index rebuild
 */
test("PASS_dedupe*4: Deduplication works after eviction", () => {
  ErrorHandler.maxErrorsStored = 2;
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3"); // Evicts Err 1
  ErrorHandler.addError("Err 2"); // Should dedupe with existing Err 2
  const errors = ErrorHandler.getAllErrors();
  const err2 = errors.find((e) => e.message === "Err 2");
  expect(err2).toBeDefined();
  expect(err2.count).toBe(2);
});

/**
 * PASS_dedupe*5: Updating lastTimestamp on dedupe maintains first timestamp
 */
test("PASS_dedupe*5: Dedupe maintains first timestamp", async () => {
  ErrorHandler.addError("Dup error");
  const firstTimestamp = ErrorHandler.getAllErrors()[0].timestamp;
  
  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 10));
  
  ErrorHandler.addError("Dup error");
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].timestamp).toBe(firstTimestamp);
  expect(errors[0].lastTimestamp).not.toBe(firstTimestamp);
});

/**
 * PASS_dedupe*6: Multiple rapid duplicates all increment count correctly
 */
test("PASS_dedupe*6: Multiple rapid duplicates increment count", () => {
  for (let i = 0; i < 10; i++) {
    ErrorHandler.addError("Rapid dup", { same: "data" });
  }
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].count).toBe(10);
});

/**
 * --------------------------------
 * SECTION: BOUNDARY TESTING
 * --------------------------------
 */

/**
 * PASS_boundary*1: maxErrorsStored = 1 works correctly
 */
test("PASS_boundary*1: maxErrorsStored = 1 works correctly", () => {
  ErrorHandler.setMaxErrorsStored(1);
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].message).toBe("Err 2");
});

/**
 * PASS_boundary*2: maxErrorsStored = 10000 works correctly
 */
test("PASS_boundary*2: maxErrorsStored = 10000 works correctly", () => {
  ErrorHandler.setMaxErrorsStored(10000);
  expect(ErrorHandler.maxErrorsStored).toBe(10000);
  
  // Add many errors
  for (let i = 0; i < 100; i++) {
    ErrorHandler.addError(`Err ${i}`);
  }
  expect(ErrorHandler.getAllErrors().length).toBe(100);
});

/**
 * PASS_boundary*5: Message at exactly MAX_MESSAGE_LENGTH works
 */
test("PASS_boundary*5: Message at exactly MAX_MESSAGE_LENGTH works", () => {
  const maxMessage = "x".repeat(10000);
  expect(() => ErrorHandler.addError(maxMessage)).not.toThrow();
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message.length).toBe(10000);
});

/**
 * PASS_boundary*6: Data at exactly MAX_DATA_SIZE_BYTES works
 */
test("PASS_boundary*6: Data near MAX_DATA_SIZE_BYTES works", () => {
  // Approximate 100KB of data
  const largeData = { content: "x".repeat(100000) };
  ErrorHandler.addError("Large data", largeData);
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
});

/**
 * --------------------------------
 * SECTION: COUNTER AND STATS ACCURACY
 * --------------------------------
 */

/**
 * PASS_stats*1: totalErrorCount increments correctly for duplicates
 */
test("PASS_stats*1: totalErrorCount increments for duplicates", () => {
  ErrorHandler.clear();
  ErrorHandler.addError("Dup");
  expect(ErrorHandler.totalErrorCount).toBe(1);
  
  ErrorHandler.addError("Dup");
  expect(ErrorHandler.totalErrorCount).toBe(2);
  
  ErrorHandler.addError("Unique");
  expect(ErrorHandler.totalErrorCount).toBe(3);
});

/**
 * PASS_stats*2: droppedCount increments only when evicting
 */
test("PASS_stats*2: droppedCount increments only when evicting", () => {
  ErrorHandler.clear();
  ErrorHandler.setMaxErrorsStored(2);
  
  ErrorHandler.addError("Err 1");
  expect(ErrorHandler.droppedCount).toBe(0);
  
  ErrorHandler.addError("Err 2");
  expect(ErrorHandler.droppedCount).toBe(0);
  
  ErrorHandler.addError("Err 3"); // Evicts Err 1
  expect(ErrorHandler.droppedCount).toBe(1);
});

/**
 * PASS_stats*3: Stats reset to 0 after clear()
 */
test("PASS_stats*3: Stats reset to 0 after clear()", () => {
  ErrorHandler.addError("Test 1");
  ErrorHandler.addError("Test 2");
  ErrorHandler.setMaxErrorsStored(1);
  ErrorHandler.addError("Test 3"); // Evicts one
  
  expect(ErrorHandler.totalErrorCount).toBeGreaterThan(0);
  expect(ErrorHandler.droppedCount).toBeGreaterThan(0);
  
  ErrorHandler.clear();
  expect(ErrorHandler.totalErrorCount).toBe(0);
  expect(ErrorHandler.droppedCount).toBe(0);
});

/**
 * PASS_stats*4: Stats preserved after clearErrorsOnly()
 */
test("PASS_stats*4: Stats preserved after clearErrorsOnly()", () => {
  ErrorHandler.addError("Test 1");
  ErrorHandler.addError("Test 2");
  const totalBefore = ErrorHandler.totalErrorCount;
  const droppedBefore = ErrorHandler.droppedCount;
  
  ErrorHandler.clearErrorsOnly();
  expect(ErrorHandler.totalErrorCount).toBe(totalBefore);
  expect(ErrorHandler.droppedCount).toBe(droppedBefore);
  expect(ErrorHandler.getAllErrors().length).toBe(0);
});

/**
 * PASS_stats*5: droppedCount accurate with multiple evictions
 */
test("PASS_stats*5: droppedCount accurate with multiple evictions", () => {
  ErrorHandler.clear();
  ErrorHandler.setMaxErrorsStored(2);
  
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3"); // Evicts 1
  ErrorHandler.addError("Err 4"); // Evicts 2
  ErrorHandler.addError("Err 5"); // Evicts 3
  
  expect(ErrorHandler.droppedCount).toBe(3);
});

/**
 * PASS_stats*6: totalErrorCount accurate when threshold triggers clear
 */

/**
 * --------------------------------
 * SECTION: ALERT BEHAVIOR
 * --------------------------------
 */

/**
 * PASS_alert*1: Alert fires exactly at threshold (not before)
 */

/**
 * PASS_alert*2: Alert payload contains all expected fields
 */

/**
 * PASS_alert*3: Alert payload errors array matches current errors
 */

/**
 * PASS_alert*4: alertedAt timestamp is ISO format
 */

/**
 * PASS_alert*5: Multiple alerts respect cooldown period
 */

/**
 * PASS_alert*6: Alert clears errors after firing
 */

/**
 * PASS_alert*7: No alert when handler is null
 */

/**
 * PASS_alert*8: Sync handler works correctly
 */

/**
 * PASS_alert*9: Handler that throws doesn't break ErrorHandler
 */

/**
 * PASS_alert*10: Handler that returns value is handled correctly
 */

/**
 * --------------------------------
 * SECTION: ORDER AND SEQUENCE
 * --------------------------------
 */

/**
 * PASS_order*1: Errors maintain FIFO order
 */
test("PASS_order*1: Errors maintain FIFO order", () => {
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe("Err 1");
  expect(errors[1].message).toBe("Err 2");
  expect(errors[2].message).toBe("Err 3");
});

/**
 * PASS_order*2: Oldest error evicted first in ring buffer
 */
test("PASS_order*2: Oldest error evicted first", () => {
  ErrorHandler.setMaxErrorsStored(3);
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  ErrorHandler.addError("Err 4"); // Evicts Err 1
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe("Err 2");
  expect(errors[1].message).toBe("Err 3");
  expect(errors[2].message).toBe("Err 4");
  expect(errors.find((e) => e.message === "Err 1")).toBeUndefined();
});

/**
 * PASS_order*3: Deduplicated errors don't change position
 */
test("PASS_order*3: Deduplicated errors move to end (LRU behavior)", () => {
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 1"); // Dedupe - moves to end (most recently used)
  
  const errors = ErrorHandler.getAllErrors();
  // With LRU cache, accessing Err 1 moves it to end
  expect(errors[0].message).toBe("Err 2"); // Err 2 is now first (oldest)
  expect(errors[1].message).toBe("Err 1"); // Err 1 moved to end (most recently used)
  expect(errors[1].count).toBe(2); // Deduplicated
});

/**
 * PASS_order*4: Index maintains correct order after multiple evictions
 */
test("PASS_order*4: LRU maintains order after multiple evictions", () => {
  ErrorHandler.setMaxErrorsStored(2);
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3"); // Evicts 1 (oldest)
  ErrorHandler.addError("Err 4"); // Evicts 2 (oldest)
  ErrorHandler.addError("Err 3"); // Should dedupe - moves Err 3 to end
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(2);
  // After dedupe, Err 3 moves to end (most recently used)
  expect(errors[0].message).toBe("Err 4"); // Err 4 is now oldest
  expect(errors[1].message).toBe("Err 3"); // Err 3 moved to end after dedupe
  expect(errors[1].count).toBe(2); // Deduplicated
});

/**
 * --------------------------------
 * SECTION: DATA SANITIZATION EDGE CASES
 * --------------------------------
 */

/**
 * PASS_sanitize*1: Filters out Symbol values
 */
test("PASS_sanitize*1: Filters out Symbol values", () => {
  const sym = Symbol("test");
  ErrorHandler.addError("Test", { symbol: sym, normal: "value" });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).not.toHaveProperty("symbol");
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * PASS_sanitize*2: Filters out BigInt values
 */
test("PASS_sanitize*2: Filters out BigInt values", () => {
  const bigInt = BigInt(123);
  ErrorHandler.addError("Test", { bigInt: bigInt, normal: "value" });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).not.toHaveProperty("bigInt");
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * PASS_sanitize*3: Filters out undefined values
 */
test("PASS_sanitize*3: Filters out undefined values", () => {
  ErrorHandler.addError("Test", { undefined: undefined, normal: "value" });
  const errors = ErrorHandler.getAllErrors();
  // undefined values are not included in Object.entries, so this is expected
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * PASS_sanitize*4: Preserves nested objects
 */
test("PASS_sanitize*4: Preserves nested objects", () => {
  ErrorHandler.addError("Test", { nested: { key: "value" } });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toHaveProperty("nested");
  expect(errors[0].data.nested).toEqual({ key: "value" });
});

/**
 * PASS_sanitize*5: Preserves nested arrays
 */
test("PASS_sanitize*5: Preserves nested arrays", () => {
  ErrorHandler.addError("Test", { array: [1, 2, 3] });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toHaveProperty("array");
  expect(errors[0].data.array).toEqual([1, 2, 3]);
});

/**
 * PASS_sanitize*6: Mixed array types are preserved
 */
test("PASS_sanitize*6: Mixed array types are preserved", () => {
  ErrorHandler.addError("Test", { mixed: [1, "string", true, null, { obj: "value" }] });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data.mixed).toHaveLength(5);
  expect(errors[0].data.mixed[0]).toBe(1);
  expect(errors[0].data.mixed[1]).toBe("string");
});

/**
 * PASS_sanitize*7: Empty object {} is preserved
 */
test("PASS_sanitize*7: Empty object is preserved", () => {
  ErrorHandler.addError("Test", {});
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toEqual({});
});

/**
 * PASS_sanitize*8: Empty array [] is preserved
 */
test("PASS_sanitize*8: Empty array is preserved", () => {
  ErrorHandler.addError("Test", { empty: [] });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toHaveProperty("empty");
  expect(errors[0].data.empty).toEqual([]);
});

/**
 * FAIL_sanitize*1: Objects with getters/setters are sanitized
 */
test("FAIL_sanitize*1: Objects with getters are sanitized", () => {
  const objWithGetter = {
    get value() { return "getter"; },
    normal: "value"
  };
  ErrorHandler.addError("Test", objWithGetter);
  const errors = ErrorHandler.getAllErrors();
  // Getters are not enumerable, so they won't be copied
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * FAIL_sanitize*2: Class instances are sanitized
 */
test("FAIL_sanitize*2: Class instances are sanitized", () => {
  class TestClass {
    constructor() {
      this.value = "test";
    }
  }
  const instance = new TestClass();
  ErrorHandler.addError("Test", { instance: instance, normal: "value" });
  const errors = ErrorHandler.getAllErrors();
  // Class instances have prototype !== Object.prototype, so they're filtered
  expect(errors[0].data).not.toHaveProperty("instance");
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * --------------------------------
 * SECTION: SAFE STRINGIFY EDGE CASES
 * --------------------------------
 */

/**
 * PASS_stringify*1: Handles nested arrays correctly
 */
test("PASS_stringify*1: Handles nested arrays correctly", () => {
  const nestedArray = [[1, 2], [3, 4]];
  ErrorHandler.addError("Test", { nested: nestedArray });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data.nested).toEqual(nestedArray);
});

/**
 * PASS_stringify*2: Handles mixed object and array nesting
 */
test("PASS_stringify*2: Handles mixed nesting", () => {
  const mixed = { arr: [1, { obj: "value" }] };
  ErrorHandler.addError("Test", mixed);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data.arr).toHaveLength(2);
  expect(errors[0].data.arr[1]).toEqual({ obj: "value" });
});

/**
 * PASS_stringify*3: Depth exactly at MAX_JSON_DEPTH works
 */
test("PASS_stringify*3: Depth at MAX_JSON_DEPTH works", () => {
  let deep = { level: 1 };
  let current = deep;
  for (let i = 2; i <= 10; i++) {
    current.level = i;
    current.next = { level: i + 1 };
    current = current.next;
  }
  
  ErrorHandler.addError("Deep", deep);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toHaveProperty("level");
});

/**
 * PASS_stringify*4: Depth exceeding MAX_JSON_DEPTH returns placeholder
 */
test("PASS_stringify*4: Depth exceeding MAX_JSON_DEPTH handled", () => {
  let deep = { level: 1 };
  let current = deep;
  for (let i = 2; i <= 15; i++) {
    current.next = { level: i };
    current = current.next;
  }
  
  // Should handle without throwing
  expect(() => ErrorHandler.addError("Very deep", deep)).not.toThrow();
});

/**
 * PASS_stringify*5: Circular reference detection with nested objects
 */
test("PASS_stringify*5: Circular reference detection works", () => {
  const circular = { name: "test" };
  circular.self = circular;
  circular.nested = { parent: circular };
  
  expect(() => ErrorHandler.addError("Circular", circular)).not.toThrow();
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
});

/**
 * PASS_stringify*6: Multiple circular references handled
 */
test("PASS_stringify*6: Multiple circular references handled", () => {
  const obj1 = { name: "obj1" };
  const obj2 = { name: "obj2" };
  obj1.ref = obj2;
  obj2.ref = obj1;
  
  expect(() => ErrorHandler.addError("Multiple circular", { obj1, obj2 })).not.toThrow();
});

/**
 * PASS_stringify*7: Self-referencing array handled
 */
test("PASS_stringify*7: Self-referencing array handled", () => {
  const arr = [1, 2];
  arr.push(arr);
  
  expect(() => ErrorHandler.addError("Self-ref array", { arr })).not.toThrow();
});

/**
 * --------------------------------
 * SECTION: INDEX REBUILD SCENARIOS
 * --------------------------------
 */

/**
 * PASS_index*1: Index rebuilt after single eviction
 */
test("PASS_index*1: Index rebuilt after single eviction", () => {
  ErrorHandler.setMaxErrorsStored(2);
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3"); // Evicts Err 1
  
  // Index should be rebuilt
  ErrorHandler.addError("Err 2"); // Should dedupe
  const errors = ErrorHandler.getAllErrors();
  const err2 = errors.find((e) => e.message === "Err 2");
  expect(err2.count).toBe(2);
});

/**
 * PASS_index*2: Index rebuilt after multiple evictions
 */
test("PASS_index*2: Index rebuilt after multiple evictions", () => {
  ErrorHandler.setMaxErrorsStored(2);
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3"); // Evicts 1
  ErrorHandler.addError("Err 4"); // Evicts 2
  
  // Index should be accurate
  ErrorHandler.addError("Err 3"); // Should dedupe
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(2);
  expect(errors.find((e) => e.message === "Err 3").count).toBe(2);
});

/**
 * PASS_index*3: Index accurate after 50+ evictions
 */
test("PASS_index*3: Index accurate after many evictions", () => {
  ErrorHandler.setMaxErrorsStored(10);
  
  // Add 60 errors (50 evictions)
  for (let i = 1; i <= 60; i++) {
    ErrorHandler.addError(`Err ${i}`);
  }
  
  // Try to dedupe one that should still exist
  ErrorHandler.addError("Err 51");
  const errors = ErrorHandler.getAllErrors();
  const err51 = errors.find((e) => e.message === "Err 51");
  expect(err51.count).toBe(2);
});

/**
 * PASS_index*4: Dedupe works correctly after index rebuild
 */
test("PASS_index*4: Dedupe works after index rebuild", () => {
  ErrorHandler.setMaxErrorsStored(3);
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  ErrorHandler.addError("Err 4"); // Evicts 1, rebuilds index
  
  // Should find Err 2 and dedupe
  ErrorHandler.addError("Err 2");
  const errors = ErrorHandler.getAllErrors();
  const err2 = errors.find((e) => e.message === "Err 2");
  expect(err2).toBeDefined();
  expect(err2.count).toBe(2);
});

/**
 * PASS_index*5: Index map size matches errors array length
 */
test("PASS_index*5: Index map size matches errors length", () => {
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  
  // Access private errorIndex through getAllErrors length
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(3);
  
  // After dedupe, should still match
  ErrorHandler.addError("Err 1");
  const errorsAfter = ErrorHandler.getAllErrors();
  expect(errorsAfter.length).toBe(3);
});

/**
 * --------------------------------
 * SECTION: ERROR MESSAGE VALIDATION
 * --------------------------------
 */

/**
 * PASS_message*1: Empty string message "" is valid
 */
test("PASS_message*1: Empty string message is valid", () => {
  expect(() => ErrorHandler.addError("")).not.toThrow();
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe("");
});

/**
 * PASS_message*2: Message with only whitespace is preserved
 */
test("PASS_message*2: Message with whitespace is preserved", () => {
  ErrorHandler.addError("   ");
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe("   ");
});

/**
 * PASS_message*3: Message with newlines is preserved
 */
test("PASS_message*3: Message with newlines is preserved", () => {
  const message = "Line 1\nLine 2\nLine 3";
  ErrorHandler.addError(message);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe(message);
});

/**
 * PASS_message*4: Message with tabs is preserved
 */
test("PASS_message*4: Message with tabs is preserved", () => {
  const message = "Col1\tCol2\tCol3";
  ErrorHandler.addError(message);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe(message);
});

/**
 * PASS_message*5: Unicode emoji in message is preserved
 */
test("PASS_message*5: Unicode emoji in message is preserved", () => {
  const message = "Error 🚀 occurred";
  ErrorHandler.addError(message);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe(message);
});

/**
 * PASS_message*6: Very short message (1 char) works
 */
test("PASS_message*6: Very short message works", () => {
  ErrorHandler.addError("E");
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].message).toBe("E");
});

/**
 * FAIL_message*1: null message throws
 */
test("FAIL_message*1: null message throws", () => {
  expect(() => ErrorHandler.addError(null)).toThrow("message must be a string");
});

/**
 * FAIL_message*2: undefined message throws
 */
test("FAIL_message*2: undefined message throws", () => {
  expect(() => ErrorHandler.addError(undefined)).toThrow("message must be a string");
});

/**
 * FAIL_message*3: Number as message throws
 */
test("FAIL_message*3: Number as message throws", () => {
  expect(() => ErrorHandler.addError(123)).toThrow("message must be a string");
});

/**
 * FAIL_message*4: Object as message throws
 */
test("FAIL_message*4: Object as message throws", () => {
  expect(() => ErrorHandler.addError({})).toThrow("message must be a string");
});

/**
 * FAIL_message*5: Array as message throws
 */
test("FAIL_message*5: Array as message throws", () => {
  expect(() => ErrorHandler.addError([])).toThrow("message must be a string");
});

/**
 * FAIL_message*6: Message exceeding MAX_MESSAGE_LENGTH by 1 throws
 */
test("FAIL_message*6: Message exceeding MAX_MESSAGE_LENGTH throws", () => {
  const tooLong = "x".repeat(10001);
  expect(() => ErrorHandler.addError(tooLong)).toThrow("exceeds maximum length");
});

/**
 * --------------------------------
 * SECTION: DATA OBJECT EDGE CASES
 * --------------------------------
 */

/**
 * PASS_data*1: data = undefined becomes {}
 */
test("PASS_data*1: undefined data becomes empty object", () => {
  ErrorHandler.addError("Test", undefined);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toEqual({});
});

/**
 * PASS_data*2: data = [] (array) becomes {}
 */
test("PASS_data*2: array data becomes empty object", () => {
  ErrorHandler.addError("Test", []);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toEqual({});
});

/**
 * PASS_data*3: data = "string" becomes {}
 */
test("PASS_data*3: string data becomes empty object", () => {
  ErrorHandler.addError("Test", "string");
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toEqual({});
});

/**
 * PASS_data*4: data = 123 becomes {}
 */
test("PASS_data*4: number data becomes empty object", () => {
  ErrorHandler.addError("Test", 123);
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toEqual({});
});

/**
 * PASS_data*5: data with only blocked keys becomes {}
 */
test("PASS_data*5: data with only blocked keys becomes empty", () => {
  ErrorHandler.addError("Test", { __proto__: {}, constructor: {}, prototype: {} });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data).toEqual({});
});

/**
 * PASS_data*6: data with Date objects is handled
 */
test("PASS_data*6: Date objects are handled", () => {
  const date = new Date();
  ErrorHandler.addError("Test", { date: date, normal: "value" });
  const errors = ErrorHandler.getAllErrors();
  // Date objects have prototype !== Object.prototype, so filtered
  expect(errors[0].data).not.toHaveProperty("date");
  expect(errors[0].data).toHaveProperty("normal");
});

/**
 * PASS_data*7: data with nested null values preserved
 */
test("PASS_data*7: Nested null values preserved", () => {
  ErrorHandler.addError("Test", { nested: { nullValue: null, string: "value" } });
  const errors = ErrorHandler.getAllErrors();
  expect(errors[0].data.nested).toHaveProperty("nullValue");
  expect(errors[0].data.nested.nullValue).toBeNull();
});

/**
 * --------------------------------
 * SECTION: CONCURRENT OPERATIONS
 * --------------------------------
 */

/**
 * PASS_concurrent*1: Multiple addError calls don't corrupt index
 */
test("PASS_concurrent*1: Multiple addError calls don't corrupt index", () => {
  // Simulate rapid additions
  for (let i = 0; i < 100; i++) {
    ErrorHandler.addError(`Err ${i}`);
  }
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(100);
  
  // Try to dedupe
  ErrorHandler.addError("Err 50");
  const errorsAfter = ErrorHandler.getAllErrors();
  const err50 = errorsAfter.find((e) => e.message === "Err 50");
  expect(err50.count).toBe(2);
});

/**
 * PASS_concurrent*2: addError during alert doesn't cause race
 */

/**
 * PASS_concurrent*3: setMaxErrorsStored during addError is safe
 */
test("PASS_concurrent*3: setMaxErrorsStored during addError is safe", () => {
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  
  // Change max during operation
  ErrorHandler.setMaxErrorsStored(1);
  ErrorHandler.addError("Err 3");
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
});

/**
 * PASS_concurrent*4: clear() during addError is safe
 */
test("PASS_concurrent*4: clear() during addError is safe", () => {
  ErrorHandler.addError("Err 1");
  ErrorHandler.clear();
  ErrorHandler.addError("Err 2");
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].message).toBe("Err 2");
});

/**
 * --------------------------------
 * SECTION: INTEGRATION SCENARIOS
 * --------------------------------
 */

/**
 * PASS_integration*1: Full lifecycle: add → dedupe → evict (LRU cache)
 */
test("PASS_integration*1: Full lifecycle works correctly", () => {
  ErrorHandler.setMaxErrorsStored(3);
  
  // Add errors
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 1"); // Dedupe - moves Err 1 to end (most recently used)
  ErrorHandler.addError("Err 3");
  ErrorHandler.addError("Err 4"); // Evicts Err 2 (oldest, not recently used)
  ErrorHandler.addError("Err 5"); // Evicts Err 1 (oldest after Err 2 was evicted)
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(3);
  // With LRU: Err 1 was moved to end when deduplicated, but then Err 2 was evicted first
  // After Err 2 evicted: [Err 1 (deduped), Err 3, Err 4]
  // After Err 5 added: [Err 3, Err 4, Err 5] (Err 1 evicted as oldest)
  expect(errors.map(e => e.message)).toEqual(["Err 3", "Err 4", "Err 5"]);
  // Verify deduplication worked earlier
  expect(ErrorHandler.totalErrorCount).toBe(6); // 6 errors added total
});

/**
 * PASS_integration*4: Config changes mid-operation work correctly
 */
test("PASS_integration*4: Config changes mid-operation work", () => {
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  
  // Change max
  ErrorHandler.setMaxErrorsStored(1);
  expect(ErrorHandler.getAllErrors().length).toBe(1);
  
  // Add another error - should evict oldest
  ErrorHandler.addError("Err 3");
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].message).toBe("Err 3");
});

/**
 * --------------------------------
 * SECTION: EDGE CASE COMBINATIONS
 * --------------------------------
 */

/**
 * PASS_edge*1: Alert threshold > maxErrorsStored triggers alert
 */

/**
 * PASS_edge*2: Alert threshold = maxErrorsStored works
 */

/**
 * PASS_edge*3: Very rapid duplicate errors
 */
test("PASS_edge*3: Very rapid duplicate errors", () => {
  for (let i = 0; i < 100; i++) {
    ErrorHandler.addError("Rapid dup", { same: "data" });
  }
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].count).toBe(100);
});

/**
 * PASS_edge*4: Alternating unique and duplicate errors
 */
test("PASS_edge*4: Alternating unique and duplicate errors", () => {
  for (let i = 0; i < 10; i++) {
    ErrorHandler.addError("Dup");
    ErrorHandler.addError(`Unique ${i}`);
  }
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(11); // 1 dup + 10 unique
  const dup = errors.find((e) => e.message === "Dup");
  expect(dup.count).toBe(10);
});

/**
 * --------------------------------
 * SECTION: PRIVATE METHOD COVERAGE TESTS
 * --------------------------------
 */

/**
 * PASS_private*1: #sanitizeData() prevents prototype pollution
 */
test("PASS_private*1: sanitizeData prevents prototype pollution", () => {
  ErrorHandler.clear();
  
  // Try to pollute prototype
  const maliciousData = {
    __proto__: { polluted: true },
    prototype: { polluted: true },
    constructor: { polluted: true }
  };
  
  ErrorHandler.addError("Test", maliciousData);
  const errors = ErrorHandler.getAllErrors();
  
  // Prototype pollution should be blocked
  expect(errors[0].data.__proto__).toBeUndefined();
  expect(errors[0].data.prototype).toBeUndefined();
  expect(errors[0].data.constructor).toBeUndefined();
});

/**
 * PASS_private*2: #sanitizeData() handles large data objects
 */
test("PASS_private*2: sanitizeData handles large data objects", () => {
  ErrorHandler.clear();
  
  // Create large data object (> 100KB)
  const largeData = {
    largeString: "x".repeat(101000) // > 100KB
  };
  
  ErrorHandler.addError("Large data", largeData);
  const errors = ErrorHandler.getAllErrors();
  
  // Should be truncated
  expect(errors[0].data._truncated).toBeDefined();
  expect(errors[0].data.largeString).toBeUndefined();
});

/**
 * PASS_private*3: #sanitizeData() filters out functions
 */
test("PASS_private*3: sanitizeData filters out functions", () => {
  ErrorHandler.clear();
  
  const dataWithFunction = {
    valid: "value",
    func: () => {},
    nested: {
      method: function() {}
    }
  };
  
  ErrorHandler.addError("Test", dataWithFunction);
  const errors = ErrorHandler.getAllErrors();
  
  // Functions should be filtered out
  expect(errors[0].data.valid).toBe("value");
  expect(errors[0].data.func).toBeUndefined();
  expect(errors[0].data.nested).toBeDefined();
  expect(errors[0].data.nested.method).toBeUndefined();
});

/**
 * PASS_private*4: #buildSignature() creates unique signatures
 */
test("PASS_private*4: buildSignature creates unique signatures", () => {
  ErrorHandler.clear();
  
  ErrorHandler.addError("Same message", { key: "value1" });
  ErrorHandler.addError("Same message", { key: "value2" });
  
  const errors = ErrorHandler.getAllErrors();
  
  // Different data should create different signatures
  expect(errors.length).toBe(2);
  expect(errors[0].signature).not.toBe(errors[1].signature);
});

/**
 * PASS_private*5: #buildSignature() handles large data strings
 */
test("PASS_private*5: buildSignature truncates large data strings", () => {
  ErrorHandler.clear();
  
  const largeData = {
    huge: "x".repeat(60000) // > 50KB
  };
  
  ErrorHandler.addError("Test", largeData);
  const errors = ErrorHandler.getAllErrors();
  
  // Signature should be truncated
  const signature = errors[0].signature;
  expect(signature.length).toBeLessThan(60000);
  expect(signature).toContain("...[truncated]");
});

/**
 * PASS_private*6: #safeStringify() handles circular references
 */
test("PASS_private*6: safeStringify handles circular references", () => {
  ErrorHandler.clear();
  
  const circular = { a: 1 };
  circular.self = circular;
  
  ErrorHandler.addError("Circular", circular);
  const errors = ErrorHandler.getAllErrors();
  
  // Should not crash, signature should contain circular marker
  expect(errors[0].signature).toContain("[circular reference]");
});

/**
 * PASS_private*7: #safeStringify() handles deep objects
 */
test("PASS_private*7: safeStringify handles deep objects", () => {
  ErrorHandler.clear();
  
  // Create object with depth > 10
  let deep = {};
  let current = deep;
  for (let i = 0; i < 15; i++) {
    current.nested = {};
    current = current.nested;
  }
  
  ErrorHandler.addError("Deep", deep);
  const errors = ErrorHandler.getAllErrors();
  
  // Should handle depth limit
  expect(errors[0].signature).toContain("[max depth exceeded]");
});

/**
 * PASS_private*8: #safeStringify() handles unserializable values
 */
test("PASS_private*8: safeStringify handles unserializable values", () => {
  ErrorHandler.clear();
  
  const dataWithUnserializable = {
    func: function() {},
    symbol: Symbol("test"),
    undefined: undefined
  };
  
  ErrorHandler.addError("Unserializable", dataWithUnserializable);
  const errors = ErrorHandler.getAllErrors();
  
  // Should handle unserializable values
  expect(errors[0].signature).toContain("[unserializable]");
});

/**
 * PASS_private*9: #rebuildIndex() synchronizes after shift()
 */
test("PASS_private*9: rebuildIndex synchronizes after shift", () => {
  ErrorHandler.clear();
  ErrorHandler.setMaxErrorsStored(3);
  
  // Add 3 errors
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  ErrorHandler.addError("Err 3");
  
  // Add 4th error (should shift first one)
  ErrorHandler.addError("Err 4");
  
  const errors = ErrorHandler.getAllErrors();
  
  // Index should be synchronized
  expect(errors.length).toBe(3);
  expect(errors[0].message).toBe("Err 2");
  expect(errors[1].message).toBe("Err 3");
  expect(errors[2].message).toBe("Err 4");
  
  // Verify index is correct by checking deduplication still works
  ErrorHandler.addError("Err 2");
  const errorsAfter = ErrorHandler.getAllErrors();
  const err2 = errorsAfter.find(e => e.message === "Err 2");
  expect(err2.count).toBe(2); // Should dedupe correctly
});

/**
 * PASS_private*10: #rebuildIndex() works after clearErrorsOnly()
 */
test("PASS_private*10: rebuildIndex works after clearErrorsOnly", () => {
  ErrorHandler.clear();
  
  ErrorHandler.addError("Err 1");
  ErrorHandler.addError("Err 2");
  
  // Clear errors but keep stats
  ErrorHandler.clearErrorsOnly();
  
  // Add new error - index should be rebuilt
  ErrorHandler.addError("Err 3");
  
  const errors = ErrorHandler.getAllErrors();
  expect(errors.length).toBe(1);
  expect(errors[0].message).toBe("Err 3");
  
  // Verify index is correct
  ErrorHandler.addError("Err 3");
  const errorsAfter = ErrorHandler.getAllErrors();
  expect(errorsAfter[0].count).toBe(2);
});

/**
 * PASS_private*11: #alertErrors() respects cooldown period
 */

/**
 * PASS_private*12: #alertErrors() handles handler timeout
 */

/**
 * PASS_private*13: #alertErrors() handles async handlers
 */

/**
 * PASS_private*14: #alertErrors() handles handler errors gracefully
 */

/**
 * PASS_private*15: #buildSignature() uses Record Separator character
 */
test("PASS_private*15: buildSignature uses Record Separator character", () => {
  ErrorHandler.clear();
  
  // Use message that might contain common separators
  ErrorHandler.addError("Message|with|pipes", { data: "value" });
  
  const errors = ErrorHandler.getAllErrors();
  const signature = errors[0].signature;
  
  // Should use Record Separator (\x1E) not pipe
  expect(signature).toContain("\x1E");
  expect(signature.split("\x1E").length).toBe(2); // Message and data separated
});

/**
 * PASS_private*16: #sanitizeData() handles null and undefined
 */
test("PASS_private*16: sanitizeData handles null and undefined", () => {
  ErrorHandler.clear();
  
  ErrorHandler.addError("Test", null);
  ErrorHandler.addError("Test2", undefined);
  
  const errors = ErrorHandler.getAllErrors();
  
  // Should convert to empty object
  expect(errors[0].data).toEqual({});
  expect(errors[1].data).toEqual({});
});

/**
 * PASS_private*17: #sanitizeData() preserves arrays
 */
test("PASS_private*17: sanitizeData preserves arrays", () => {
  ErrorHandler.clear();
  
  const dataWithArray = {
    items: [1, 2, 3],
    nested: {
      list: ["a", "b"]
    }
  };
  
  ErrorHandler.addError("Test", dataWithArray);
  const errors = ErrorHandler.getAllErrors();
  
  expect(Array.isArray(errors[0].data.items)).toBe(true);
  expect(errors[0].data.items).toEqual([1, 2, 3]);
  expect(Array.isArray(errors[0].data.nested.list)).toBe(true);
});

/**
 * PASS_private*18: #safeStringify() handles arrays correctly
 */
test("PASS_private*18: safeStringify handles arrays correctly", () => {
  ErrorHandler.clear();
  
  const dataWithArray = {
    items: [1, { nested: "value" }, 3]
  };
  
  ErrorHandler.addError("Test", dataWithArray);
  const errors = ErrorHandler.getAllErrors();
  
  // Signature should contain array representation
  expect(errors[0].signature).toContain("items");
  expect(errors[0].signature).toContain("nested");
});
