const fs = require('fs');
const path = require('path');

// Dynamically load SafeUtils implementation from config to avoid static paths
const CONFIG_PATH = path.resolve(__dirname, '..', 'test-runner.config.js');
let SafeUtils;
try {
  const cfg = require(CONFIG_PATH);
  const cls = cfg.classes.find((c) => c.name === 'SafeUtils');
  if (!cls) throw new Error('SafeUtils not found in config');
  SafeUtils = require(path.resolve(cfg.rootDir, cls.src));
} catch (err) {
  // Fallback to direct path when config entry is missing
  SafeUtils = require(path.resolve(__dirname, '..', '..', '..', 'src', 'utils', 'SafeUtils.js'));
}

// Inject JSDOM into SafeUtils for HTML whitelist tests. We rely on a
// CommonJS-compatible jsdom version (pinned in tests/jest/package.json)
// so that require('jsdom') works under Jest.
try {
  // eslint-disable-next-line global-require
  const { JSDOM } = require('jsdom');
  // eslint-disable-next-line no-underscore-dangle
  SafeUtils._JSDOM = JSDOM;
} catch (e) {
  // When jsdom is not available, sanitizeHtmlWithWhitelist will fall back
  // to its non-DOM behaviour; related tests will then fail and surface
  // the misconfiguration.
}

/**
 * --------------------------------
 * SECTION: HASVALUE TESTS
 * --------------------------------
 */

/**
 * PASS_HASVALUE_1: Non-empty string is considered present.
 */
test('PASS_HASVALUE_1: Non-empty string', () => {
  expect(SafeUtils.hasValue('hello')).toBe(true);
});

/**
 * PASS_HASVALUE_2: String with spaces trimmed to non-empty is present.
 */
test('PASS_HASVALUE_2: String with surrounding spaces', () => {
  expect(SafeUtils.hasValue(' hi ')).toBe(true);
});

/**
 * PASS_HASVALUE_3: Number zero is considered present.
 */
test('PASS_HASVALUE_3: Zero number is present', () => {
  expect(SafeUtils.hasValue(0)).toBe(true);
});

/**
 * PASS_HASVALUE_4: Boolean false is considered present.
 */
test('PASS_HASVALUE_4: Boolean false is present', () => {
  expect(SafeUtils.hasValue(false)).toBe(true);
});

/**
 * PASS_HASVALUE_5: Non-empty array is considered present.
 */
test('PASS_HASVALUE_5: Non-empty array', () => {
  expect(SafeUtils.hasValue([1, 2])).toBe(true);
});

/**
 * PASS_HASVALUE_6: Object with at least one non-null/undefined value is present.
 */
test('PASS_HASVALUE_6: Object with at least one value', () => {
  expect(SafeUtils.hasValue({ a: null, b: 1 })).toBe(true);
});

/**
 * PASS_HASVALUE_7: Object with symbol key holding a value is present.
 */
test('PASS_HASVALUE_7: Object with symbol key', () => {
  const sym = Symbol('k');
  const obj = { [sym]: 42 };
  expect(SafeUtils.hasValue(obj)).toBe(true);
});

/**
 * FAIL_HASVALUE_1: Null is not considered present.
 */
test('FAIL_HASVALUE_1: Null value', () => {
  expect(SafeUtils.hasValue(null)).toBe(false);
});

/**
 * FAIL_HASVALUE_2: Undefined is not considered present.
 */
test('FAIL_HASVALUE_2: Undefined value', () => {
  expect(SafeUtils.hasValue(undefined)).toBe(false);
});

/**
 * FAIL_HASVALUE_3: Empty string is not considered present.
 */
test('FAIL_HASVALUE_3: Empty string', () => {
  expect(SafeUtils.hasValue('')).toBe(false);
});

/**
 * FAIL_HASVALUE_4: Whitespace-only string is not considered present.
 */
test('FAIL_HASVALUE_4: Whitespace-only string', () => {
  expect(SafeUtils.hasValue(' \n\t ')).toBe(false);
});

/**
 * FAIL_HASVALUE_5: Empty array is not considered present.
 */
test('FAIL_HASVALUE_5: Empty array', () => {
  expect(SafeUtils.hasValue([])).toBe(false);
});

/**
 * FAIL_HASVALUE_6: Empty object is not considered present.
 */
test('FAIL_HASVALUE_6: Empty object', () => {
  expect(SafeUtils.hasValue({})).toBe(false);
});

/**
 * FAIL_HASVALUE_7: Object with only null/undefined props is not present.
 */
test('FAIL_HASVALUE_7: Object with only nullish values', () => {
  const sym = Symbol('k');
  const obj = { a: null, [sym]: undefined };
  expect(SafeUtils.hasValue(obj)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: SANITATEVALIDATE TESTS
 * --------------------------------
 */

/**
 * PASS_SANITATEVALIDATE_1: Simple required int from string.
 */
test('PASS_SANITATEVALIDATE_1: Required int from string', () => {
  const schema = { age: { type: 'int', required: true, value: '42' } };
  const result = SafeUtils.sanitizeValidate(schema);
  expect(result).toEqual({ age: 42 });
});

/**
 * PASS_SANITATEVALIDATE_2: Optional string defaults when missing.
 */
test('PASS_SANITATEVALIDATE_2: Optional string default applied', () => {
  const schema = { name: { type: 'string', required: false, default: 'Guest' } };
  const result = SafeUtils.sanitizeValidate(schema);
  expect(result).toEqual({ name: 'Guest' });
});

/**
 * PASS_SANITATEVALIDATE_3: Optional field missing with no default becomes null.
 */
test('PASS_SANITATEVALIDATE_3: Optional missing field becomes null', () => {
  const schema = { nickname: { type: 'string', required: false } };
  const result = SafeUtils.sanitizeValidate(schema);
  expect(result).toEqual({ nickname: null });
});

/**
 * PASS_SANITATEVALIDATE_4: Multiple types processed correctly.
 */
test('PASS_SANITATEVALIDATE_4: Multiple field types', () => {
  const schema = {
    a: { type: 'int', value: '1' },
    b: { type: 'bool', value: 'true' },
    c: { type: 'email', value: 'X@Y.com' },
  };
  const result = SafeUtils.sanitizeValidate(schema);
  expect(result).toEqual({ a: 1, b: true, c: 'x@y.com' });
});

/**
 * PASS_SANITATEVALIDATE_5: Required iterable with iterator value is accepted.
 */
test('PASS_SANITATEVALIDATE_5: Required iterable Map keys', () => {
  const schema = {
    it: { type: 'iterable', required: true, value: new Map([['k', 'v']]).keys() },
  };
  const result = SafeUtils.sanitizeValidate(schema);
  expect(result).toEqual({ it: ['k'] });
});

/**
 * PASS_SANITATEVALIDATE_6: Default value is validated via sanitizer.
 */
test('PASS_SANITATEVALIDATE_6: Default int sanitized', () => {
  const schema = { age: { type: 'int', default: '10' } };
  const result = SafeUtils.sanitizeValidate(schema);
  expect(result).toEqual({ age: 10 });
});

/**
 * PASS_SANITATEVALIDATE_7: Inline schema value is used.
 */
test('PASS_SANITATEVALIDATE_7: Inline schema value', () => {
  const schema = {
    transaction_id: { value: 'tx-123', type: 'string', required: true },
  };
  const result = SafeUtils.sanitizeValidate(schema);
  expect(result).toEqual({ transaction_id: 'tx-123' });
});

/**
 * FAIL_SANITATEVALIDATE_1: Non-plain schema triggers formatError TypeError.
 */
test('FAIL_SANITATEVALIDATE_1: Non-plain schema throws', () => {
  expect(() => SafeUtils.sanitizeValidate(null)).toThrow(
    'sanitizeValidate(): schema must be a plain object',
  );
});

/**
 * FAIL_SANITATEVALIDATE_2: Rule not a plain object throws.
 */
test('FAIL_SANITATEVALIDATE_2: Non-object rule throws', () => {
  const schema = { a: 123 };
  expect(() => SafeUtils.sanitizeValidate(schema)).toThrow(
    'sanitizeValidate(): invalid schema for "a"',
  );
});

/**
 * FAIL_SANITATEVALIDATE_3: Missing type in rule throws.
 */
test('FAIL_SANITATEVALIDATE_3: Missing type in rule', () => {
  const schema = { a: { required: true } };
  expect(() => SafeUtils.sanitizeValidate(schema)).toThrow(
    'sanitizeValidate(): invalid schema for "a"',
  );
});

/**
 * FAIL_SANITATEVALIDATE_4: Unknown type string throws.
 */
test('FAIL_SANITATEVALIDATE_4: Unknown type throws', () => {
  const schema = { a: { type: 'weird' } };
  expect(() => SafeUtils.sanitizeValidate(schema)).toThrow(
    'sanitizeValidate(): unknown type "weird" for "a"',
  );
});

/**
 * FAIL_SANITATEVALIDATE_5: Missing required non-iterable field throws.
 */
test('FAIL_SANITATEVALIDATE_5: Missing required non-iterable throws', () => {
  const schema = { a: { type: 'int', required: true } };
  expect(() => SafeUtils.sanitizeValidate(schema)).toThrow(
    'Missing required parameter: a',
  );
});

/**
 * FAIL_SANITATEVALIDATE_6: Sanitizer returning null for value throws.
 */
test('FAIL_SANITATEVALIDATE_6: Failed sanitization throws', () => {
  const schema = { age: { type: 'int', value: '1.5' } };
  expect(() => SafeUtils.sanitizeValidate(schema)).toThrow(
    'sanitizeValidate(): "age" failed sanitization. Expected int.',
  );
});

/**
 * FAIL_SANITATEVALIDATE_7: Invalid default for optional field throws.
 */
test('FAIL_SANITATEVALIDATE_7: Invalid default throws', () => {
  const schema = { a: { type: 'int', default: 'foo' } };
  expect(() => SafeUtils.sanitizeValidate(schema)).toThrow(
    'sanitizeValidate(): "a" has invalid default for type int',
  );
});

/**
 * --------------------------------
 * SECTION: SANITIZEURL TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEURL_1: Valid HTTP URL returns normalized string.
 */
test('PASS_SANITIZEURL_1: Valid HTTP URL', () => {
  const url = 'http://example.com/path';
  const result = SafeUtils.sanitizeUrl(url);
  expect(result).toBe('http://example.com/path');
});

/**
 * PASS_SANITIZEURL_2: HTTPS URL with credentials strips username/password.
 */
test('PASS_SANITIZEURL_2: HTTPS URL removes credentials', () => {
  const url = 'https://user:pass@example.com/path';
  const result = SafeUtils.sanitizeUrl(url);
  expect(result).toBe('https://example.com/path');
});

/**
 * PASS_SANITIZEURL_3: URL with query and fragment preserved.
 */
test('PASS_SANITIZEURL_3: URL with query and fragment', () => {
  const url = 'https://ex.com/path?a=1#b';
  const result = SafeUtils.sanitizeUrl(url);
  expect(result).toBe('https://ex.com/path?a=1#b');
});

/**
 * PASS_SANITIZEURL_4: Max length under 2048 remains valid.
 */
test('PASS_SANITIZEURL_4: URL at max length boundary', () => {
  const base = 'http://example.com/';
  const paddingLength = 2048 - base.length;
  const longPath = base + 'a'.repeat(paddingLength);
  const result = SafeUtils.sanitizeUrl(longPath);
  expect(typeof result).toBe('string');
  expect(result.length).toBeLessThanOrEqual(2048);
});

/**
 * FAIL_SANITIZEURL_1: Non-string input returns null.
 */
test('FAIL_SANITIZEURL_1: Non-string input', () => {
  expect(SafeUtils.sanitizeUrl(123)).toBeNull();
});

/**
 * FAIL_SANITIZEURL_2: Unsupported protocol returns null.
 */
test('FAIL_SANITIZEURL_2: Unsupported protocol', () => {
  expect(SafeUtils.sanitizeUrl('ftp://example.com')).toBeNull();
});

/**
 * FAIL_SANITIZEURL_3: Host with trailing dot returns null.
 */
test('FAIL_SANITIZEURL_3: Host with trailing dot', () => {
  expect(SafeUtils.sanitizeUrl('https://example.com./')).toBeNull();
});

/**
 * FAIL_SANITIZEURL_4: Non-ASCII hostname returns null.
 */
test('FAIL_SANITIZEURL_4: Non-ASCII hostname', () => {
  expect(SafeUtils.sanitizeUrl('https://exämple.com')).toBeNull();
});

/**
 * FAIL_SANITIZEURL_5: Overlong URL (length > 2048) returns null.
 */
test('FAIL_SANITIZEURL_5: Overlong URL', () => {
  const url = 'https://example.com/' + 'a'.repeat(2050);
  expect(SafeUtils.sanitizeUrl(url)).toBeNull();
});

/**
 * FAIL_SANITIZEURL_6: URL containing control characters returns null.
 */
test('FAIL_SANITIZEURL_6: URL with control characters', () => {
  const url = 'https://ex.com/path\u0000';
  expect(SafeUtils.sanitizeUrl(url)).toBeNull();
});

/**
 * FAIL_SANITIZEURL_7: Parsing error returns null and logs when DEBUG enabled.
 */
test('FAIL_SANITIZEURL_7: Parsing throws with debug logging', () => {
  const originalDebug = SafeUtils.DEBUG;
  SafeUtils.DEBUG = true;
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  const result = SafeUtils.sanitizeUrl('http://\uD800');

  expect(result).toBeNull();
  expect(warnSpy).toHaveBeenCalled();

  warnSpy.mockRestore();
  SafeUtils.DEBUG = originalDebug;
});

/**
 * --------------------------------
 * SECTION: SANITIZETEXTFIELD TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZETEXTFIELD_1: Strips HTML tags from text.
 */
test('PASS_SANITIZETEXTFIELD_1: Strips tags', () => {
  const result = SafeUtils.sanitizeTextField('<b>Hello</b>');
  expect(result).toBe('Hello');
});

/**
 * PASS_SANITIZETEXTFIELD_2: Removes zero-width characters.
 */
test('PASS_SANITIZETEXTFIELD_2: Removes zero-width chars', () => {
  const input = 'A\u200B\u200C\uFEFFB';
  const result = SafeUtils.sanitizeTextField(input);
  expect(result).toBe('AB');
});

/**
 * PASS_SANITIZETEXTFIELD_3: Preserves newlines and tabs while trimming spaces.
 */
test('PASS_SANITIZETEXTFIELD_3: Preserve newlines and tabs', () => {
  const input = ' line1\nline2\t ';
  const result = SafeUtils.sanitizeTextField(input);
  expect(result).toBe('line1\nline2\t');
});

/**
 * PASS_SANITIZETEXTFIELD_4: Normalizes text to NFC.
 */
test('PASS_SANITIZETEXTFIELD_4: NFC normalization', () => {
  const decomposed = 'e\u0301';
  const result = SafeUtils.sanitizeTextField(decomposed);
  expect(result).toBe('\u00e9');
});

/**
 * PASS_SANITIZETEXTFIELD_5: Escapes HTML after cleaning when escape=true.
 */
test('PASS_SANITIZETEXTFIELD_5: Escape HTML after stripping tags', () => {
  const input = '<b>&"\'' + '</b>';
  const result = SafeUtils.sanitizeTextField(input, true);
  // After stripping tags, only &"' remain, then escaped
  expect(result).toBe('&amp;&quot;&#39;');
});

/**
 * FAIL_SANITIZETEXTFIELD_1: Non-string input returns null.
 */
test('FAIL_SANITIZETEXTFIELD_1: Non-string input', () => {
  expect(SafeUtils.sanitizeTextField(123)).toBeNull();
});

/**
 * FAIL_SANITIZETEXTFIELD_2: Empty after cleaning returns null.
 */
test('FAIL_SANITIZETEXTFIELD_2: Empty after cleaning', () => {
  const input = ' <b>\u200B</b> ';
  const result = SafeUtils.sanitizeTextField(input);
  expect(result).toBeNull();
});

/**
 * --------------------------------
 * SECTION: ESCURL TESTS
 * --------------------------------
 */

/**
 * PASS_ESCURL_1: Absolute HTTP URL remains unchanged (normalized).
 */
test('PASS_ESCURL_1: Absolute http URL', () => {
  const url = 'http://example.com/path';
  const result = SafeUtils.escUrl(url);
  expect(result).toBe('http://example.com/path');
});

/**
 * PASS_ESCURL_2: Credentials are stripped from HTTPS URL.
 */
test('PASS_ESCURL_2: Strips credentials', () => {
  const url = 'https://user:pass@example.com/';
  const result = SafeUtils.escUrl(url);
  expect(result).toBe('https://example.com/');
});

/**
 * PASS_ESCURL_3: Relative URL is preserved.
 */
test('PASS_ESCURL_3: Relative URL preserved', () => {
  const url = './foo?bar=1';
  const result = SafeUtils.escUrl(url);
  expect(result).toBe('./foo?bar=1');
});

/**
 * PASS_ESCURL_4: Allowed protocol list permits ftp when whitelisted.
 */
test('PASS_ESCURL_4: Allowed protocol ftp', () => {
  const url = 'ftp://example.com';
  const result = SafeUtils.escUrl(url, ['ftp:']);
  expect(result).toBe('ftp://example.com/');
});

/**
 * PASS_ESCURL_5: Query and fragment preserved for HTTPS.
 */
test('PASS_ESCURL_5: Query and fragment preserved', () => {
  const url = 'https://ex.com/p?a=1#hash';
  const result = SafeUtils.escUrl(url);
  expect(result).toBe('https://ex.com/p?a=1#hash');
});

/**
 * FAIL_ESCURL_1: Non-string or empty input returns empty string.
 */
test('FAIL_ESCURL_1: Non-string or empty', () => {
  expect(SafeUtils.escUrl(123)).toBe('');
  expect(SafeUtils.escUrl('')).toBe('');
});

/**
 * FAIL_ESCURL_2: Percent-encoded control characters are rejected.
 */
test('FAIL_ESCURL_2: Percent-encoded control char', () => {
  const url = 'https://ex.com/%00';
  expect(SafeUtils.escUrl(url)).toBe('');
});

/**
 * FAIL_ESCURL_3: Disallowed protocol returns empty string.
 */
test('FAIL_ESCURL_3: Disallowed protocol', () => {
  const url = 'ftp://ex.com';
  expect(SafeUtils.escUrl(url)).toBe('');
});

/**
 * FAIL_ESCURL_4: Relative URL with control char is rejected.
 */
test('FAIL_ESCURL_4: Relative with control char', () => {
  const url = './foo' + String.fromCharCode(0) + 'bar';
  expect(SafeUtils.escUrl(url)).toBe('');
});

/**
 * FAIL_ESCURL_5: Malformed URL that throws returns empty string.
 */
test('FAIL_ESCURL_5: Malformed URL throws', () => {
  const url = 'http://\uD800';
  expect(SafeUtils.escUrl(url)).toBe('');
});

/**
 * --------------------------------
 * SECTION: SANITIZEARRAY TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEARRAY_1: Null becomes an empty array.
 */
test('PASS_SANITIZEARRAY_1: Null input to empty array', () => {
  expect(SafeUtils.sanitizeArray(null)).toEqual([]);
});

/**
 * PASS_SANITIZEARRAY_2: Existing array is preserved.
 */
test('PASS_SANITIZEARRAY_2: Already array', () => {
  expect(SafeUtils.sanitizeArray([1, 2, 3])).toEqual([1, 2, 3]);
});

/**
 * PASS_SANITIZEARRAY_3: Scalar value is wrapped in array.
 */
test('PASS_SANITIZEARRAY_3: Wrap scalar value', () => {
  expect(SafeUtils.sanitizeArray('x')).toEqual(['x']);
});

/**
 * PASS_SANITIZEARRAY_4: Filters out empty values but keeps 0 and false.
 */
test('PASS_SANITIZEARRAY_4: Filters empties but keeps 0/false', () => {
  const input = ['', 'hi', null, 0, false];
  const result = SafeUtils.sanitizeArray(input);
  expect(result).toEqual(['hi', 0, false]);
});

/**
 * PASS_SANITIZEARRAY_5: Keeps objects considered present (drops empty objects).
 */
test('PASS_SANITIZEARRAY_5: Keeps present objects', () => {
  const input = [{ a: 1 }, {}];
  const result = SafeUtils.sanitizeArray(input);
  expect(result).toEqual([{ a: 1 }]);
});

/**
 * FAIL_SANITIZEARRAY_1: Undefined input yields empty array (no throw).
 */
test('FAIL_SANITIZEARRAY_1: Undefined input', () => {
  expect(SafeUtils.sanitizeArray(undefined)).toEqual([]);
});

/**
 * --------------------------------
 * SECTION: SANITIZEITERABLE TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEITERABLE_1: Array iterable filters out null values.
 */
test('PASS_SANITIZEITERABLE_1: Array iterable', () => {
  const result = SafeUtils.sanitizeIterable([1, null, 2]);
  expect(result).toEqual([1, 2]);
});

/**
 * PASS_SANITIZEITERABLE_2: Set iterable preserves 0 and filters null.
 */
test('PASS_SANITIZEITERABLE_2: Set iterable', () => {
  const result = SafeUtils.sanitizeIterable(new Set([1, 0, null]));
  expect(result).toEqual([1, 0]);
});

/**
 * PASS_SANITIZEITERABLE_3: Map values iterable.
 */
test('PASS_SANITIZEITERABLE_3: Map values iterable', () => {
  const map = new Map([
    ['a', 1],
    ['b', null],
  ]);
  const result = SafeUtils.sanitizeIterable(map.values());
  expect(result).toEqual([1]);
});

/**
 * FAIL_SANITIZEITERABLE_1: String input is rejected.
 */
test('FAIL_SANITIZEITERABLE_1: String is rejected', () => {
  expect(SafeUtils.sanitizeIterable('abc')).toBeNull();
});

/**
 * FAIL_SANITIZEITERABLE_2: Non-iterable object returns null.
 */
test('FAIL_SANITIZEITERABLE_2: Non-iterable object', () => {
  expect(SafeUtils.sanitizeIterable({ a: 1 })).toBeNull();
});

/**
 * FAIL_SANITIZEITERABLE_3: Null input returns null.
 */
test('FAIL_SANITIZEITERABLE_3: Null input', () => {
  expect(SafeUtils.sanitizeIterable(null)).toBeNull();
});

/**
 * FAIL_SANITIZEITERABLE_4: Iterator that throws yields null (with optional debug log).
 */
test('FAIL_SANITIZEITERABLE_4: Iterator that throws', () => {
  const originalDebug = SafeUtils.DEBUG;
  SafeUtils.DEBUG = true;
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  const throwingIterable = {
    [Symbol.iterator]() {
      return {
        next() {
          throw new Error('Iterator failure');
        },
      };
    },
  };

  const result = SafeUtils.sanitizeIterable(throwingIterable);
  expect(result).toBeNull();
  expect(warnSpy).toHaveBeenCalled();

  warnSpy.mockRestore();
  SafeUtils.DEBUG = originalDebug;
});

/**
 * --------------------------------
 * SECTION: SANITIZESTRING TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZESTRING_1: Default parameter undefined yields empty string.
 */
test('PASS_SANITIZESTRING_1: Default param undefined', () => {
  const result = SafeUtils.sanitizeString(undefined);
  expect(result).toBe('');
});

/**
 * PASS_SANITIZESTRING_2: Number is coerced to string.
 */
test('PASS_SANITIZESTRING_2: Coerce number', () => {
  const result = SafeUtils.sanitizeString(123);
  expect(result).toBe('123');
});

/**
 * PASS_SANITIZESTRING_3: Trims spaces from string.
 */
test('PASS_SANITIZESTRING_3: Trim spaces', () => {
  const result = SafeUtils.sanitizeString(' hi ');
  expect(result).toBe('hi');
});

/**
 * PASS_SANITIZESTRING_4: Escapes HTML when escape=true.
 */
test('PASS_SANITIZESTRING_4: Escape HTML', () => {
  const result = SafeUtils.sanitizeString('<b>&"\'' + '</b>', true);
  expect(result).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
});

/**
 * FAIL_SANITIZESTRING_1: Null input is coerced to string "null".
 */
test('FAIL_SANITIZESTRING_1: Null input coerced to "null"', () => {
  const result = SafeUtils.sanitizeString(null);
  expect(result).toBe('null');
});

/**
 * --------------------------------
 * SECTION: ISPLAINOBJECT TESTS
 * --------------------------------
 */

/**
 * PASS_ISPLAINOBJECT_1: Literal object is plain.
 */
test('PASS_ISPLAINOBJECT_1: Literal object', () => {
  expect(SafeUtils.isPlainObject({ a: 1 })).toBe(true);
});

/**
 * PASS_ISPLAINOBJECT_2: Object created with null prototype is plain.
 */
test('PASS_ISPLAINOBJECT_2: Object.create(null)', () => {
  const obj = Object.create(null);
  obj.a = 1;
  expect(SafeUtils.isPlainObject(obj)).toBe(true);
});

/**
 * FAIL_ISPLAINOBJECT_1: Arrays are not plain objects.
 */
test('FAIL_ISPLAINOBJECT_1: Array is not plain object', () => {
  expect(SafeUtils.isPlainObject([1, 2])).toBe(false);
});

/**
 * FAIL_ISPLAINOBJECT_2: Null is not a plain object.
 */
test('FAIL_ISPLAINOBJECT_2: Null', () => {
  expect(SafeUtils.isPlainObject(null)).toBe(false);
});

/**
 * FAIL_ISPLAINOBJECT_3: Functions are not plain objects.
 */
test('FAIL_ISPLAINOBJECT_3: Function is not plain', () => {
  expect(
    SafeUtils.isPlainObject(function fn() {
      return null;
    }),
  ).toBe(false);
});

/**
 * FAIL_ISPLAINOBJECT_4: Date instance is not a plain object.
 */
test('FAIL_ISPLAINOBJECT_4: Date instance', () => {
  expect(SafeUtils.isPlainObject(new Date())).toBe(false);
});

/**
 * --------------------------------
 * SECTION: ESCAPEHTMLENTITIES TESTS
 * --------------------------------
 */

/**
 * PASS_ESCAPEHTMLENTITIES_1: Escapes basic special characters.
 */
test('PASS_ESCAPEHTMLENTITIES_1: Basic special chars', () => {
  const result = SafeUtils.escapeHtmlEntities("&<>'\"");
  expect(result).toBe('&amp;&lt;&gt;&#39;&quot;');
});

/**
 * PASS_ESCAPEHTMLENTITIES_2: Existing entities are preserved.
 */
test('PASS_ESCAPEHTMLENTITIES_2: Existing entities preserved', () => {
  const input = '&amp; &lt; &gt;';
  const result = SafeUtils.escapeHtmlEntities(input);
  expect(result).toBe(input);
});

/**
 * PASS_ESCAPEHTMLENTITIES_3: Non-string input is coerced.
 */
test('PASS_ESCAPEHTMLENTITIES_3: Non-string coercion', () => {
  const result = SafeUtils.escapeHtmlEntities(123);
  expect(result).toBe('123');
});

/**
 * FAIL_ESCAPEHTMLENTITIES_1: Empty string remains unchanged.
 */
test('FAIL_ESCAPEHTMLENTITIES_1: Empty string', () => {
  const result = SafeUtils.escapeHtmlEntities('');
  expect(result).toBe('');
});

/**
 * --------------------------------
 * SECTION: ESCAPEHTMLQUOTES TESTS
 * --------------------------------
 */

/**
 * PASS_ESCAPEHTMLQUOTES_1: Escapes double and single quotes.
 */
test('PASS_ESCAPEHTMLQUOTES_1: Quotes escaped', () => {
  const result = SafeUtils.escapeHtmlQuotes("\"'");
  expect(result).toBe('&quot;&#39;');
});

/**
 * PASS_ESCAPEHTMLQUOTES_2: Existing entities preserved.
 */
test('PASS_ESCAPEHTMLQUOTES_2: Existing entities preserved', () => {
  const input = '&quot; &#39;';
  const result = SafeUtils.escapeHtmlQuotes(input);
  expect(result).toBe(input);
});

/**
 * PASS_ESCAPEHTMLQUOTES_3: Non-string coercion works.
 */
test('PASS_ESCAPEHTMLQUOTES_3: Non-string coercion', () => {
  const result = SafeUtils.escapeHtmlQuotes(42);
  expect(result).toBe('42');
});

/**
 * FAIL_ESCAPEHTMLQUOTES_1: String without quotes is unchanged.
 */
test('FAIL_ESCAPEHTMLQUOTES_1: No quotes', () => {
  const result = SafeUtils.escapeHtmlQuotes('abc');
  expect(result).toBe('abc');
});

/**
 * --------------------------------
 * SECTION: SANITIZEINTEGER TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEINTEGER_1: Integer number is returned.
 */
test('PASS_SANITIZEINTEGER_1: Integer number', () => {
  expect(SafeUtils.sanitizeInteger(5)).toBe(5);
});

/**
 * PASS_SANITIZEINTEGER_2: Integer string is parsed.
 */
test('PASS_SANITIZEINTEGER_2: Integer string', () => {
  expect(SafeUtils.sanitizeInteger('10')).toBe(10);
});

/**
 * PASS_SANITIZEINTEGER_3: Signed integer string is parsed.
 */
test('PASS_SANITIZEINTEGER_3: Signed integer string', () => {
  expect(SafeUtils.sanitizeInteger('-7')).toBe(-7);
});

/**
 * PASS_SANITIZEINTEGER_4: Large but safe integer passes through.
 */
test('PASS_SANITIZEINTEGER_4: Large safe integer', () => {
  const val = Number.MAX_SAFE_INTEGER;
  expect(SafeUtils.sanitizeInteger(val)).toBe(val);
});

/**
 * FAIL_SANITIZEINTEGER_1: Null input returns null.
 */
test('FAIL_SANITIZEINTEGER_1: Null input', () => {
  expect(SafeUtils.sanitizeInteger(null)).toBeNull();
});

/**
 * FAIL_SANITIZEINTEGER_2: Float number returns null.
 */
test('FAIL_SANITIZEINTEGER_2: Float number', () => {
  expect(SafeUtils.sanitizeInteger(1.5)).toBeNull();
});

/**
 * FAIL_SANITIZEINTEGER_3: Non-numeric string returns null.
 */
test('FAIL_SANITIZEINTEGER_3: Non-numeric string', () => {
  expect(SafeUtils.sanitizeInteger('abc')).toBeNull();
});

/**
 * FAIL_SANITIZEINTEGER_4: Mixed digits and characters return null.
 */
test('FAIL_SANITIZEINTEGER_4: Mixed digits and chars', () => {
  expect(SafeUtils.sanitizeInteger('12a')).toBeNull();
});

/**
 * FAIL_SANITIZEINTEGER_5: Unsafe integer returns null.
 */
test('FAIL_SANITIZEINTEGER_5: Unsafe integer', () => {
  const unsafe = Number.MAX_SAFE_INTEGER + 1;
  expect(SafeUtils.sanitizeInteger(unsafe)).toBeNull();
});

/**
 * --------------------------------
 * SECTION: SANITIZEFLOAT TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEFLOAT_1: Finite number passes through.
 */
test('PASS_SANITIZEFLOAT_1: Finite number', () => {
  expect(SafeUtils.sanitizeFloat(1.5)).toBe(1.5);
});

/**
 * PASS_SANITIZEFLOAT_2: Float string is parsed.
 */
test('PASS_SANITIZEFLOAT_2: Float string', () => {
  expect(SafeUtils.sanitizeFloat('1.5')).toBe(1.5);
});

/**
 * PASS_SANITIZEFLOAT_3: Exponent notation is accepted.
 */
test('PASS_SANITIZEFLOAT_3: Exponent notation', () => {
  expect(SafeUtils.sanitizeFloat('1e3')).toBe(1000);
});

/**
 * PASS_SANITIZEFLOAT_4: Leading dot format is accepted.
 */
test('PASS_SANITIZEFLOAT_4: Leading dot format', () => {
  expect(SafeUtils.sanitizeFloat('.5')).toBe(0.5);
});

/**
 * PASS_SANITIZEFLOAT_5: Signed float string is parsed.
 */
test('PASS_SANITIZEFLOAT_5: Signed float string', () => {
  expect(SafeUtils.sanitizeFloat(' -2.5 ')).toBe(-2.5);
});

/**
 * FAIL_SANITIZEFLOAT_1: Null input returns null.
 */
test('FAIL_SANITIZEFLOAT_1: Null input', () => {
  expect(SafeUtils.sanitizeFloat(null)).toBeNull();
});

/**
 * FAIL_SANITIZEFLOAT_2: String with comma is rejected.
 */
test('FAIL_SANITIZEFLOAT_2: String with comma', () => {
  expect(SafeUtils.sanitizeFloat('1,5')).toBeNull();
});

/**
 * FAIL_SANITIZEFLOAT_3: Non-numeric string returns null.
 */
test('FAIL_SANITIZEFLOAT_3: Non-numeric string', () => {
  expect(SafeUtils.sanitizeFloat('abc')).toBeNull();
});

/**
 * FAIL_SANITIZEFLOAT_4: Infinity is rejected.
 */
test('FAIL_SANITIZEFLOAT_4: Infinity', () => {
  expect(SafeUtils.sanitizeFloat(Infinity)).toBeNull();
});

/**
 * FAIL_SANITIZEFLOAT_5: NaN is rejected.
 */
test('FAIL_SANITIZEFLOAT_5: NaN', () => {
  expect(SafeUtils.sanitizeFloat(NaN)).toBeNull();
});

/**
 * --------------------------------
 * SECTION: SANITIZEBOOLEAN TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEBOOLEAN_1: Boolean true passes through.
 */
test('PASS_SANITIZEBOOLEAN_1: Boolean true', () => {
  expect(SafeUtils.sanitizeBoolean(true)).toBe(true);
});

/**
 * PASS_SANITIZEBOOLEAN_2: Number 1 coerces to true.
 */
test('PASS_SANITIZEBOOLEAN_2: Number 1 to true', () => {
  expect(SafeUtils.sanitizeBoolean(1)).toBe(true);
});

/**
 * PASS_SANITIZEBOOLEAN_3: Number 0 coerces to false.
 */
test('PASS_SANITIZEBOOLEAN_3: Number 0 to false', () => {
  expect(SafeUtils.sanitizeBoolean(0)).toBe(false);
});

/**
 * PASS_SANITIZEBOOLEAN_4: Truthy string coerces to true.
 */
test('PASS_SANITIZEBOOLEAN_4: Truthy string YES', () => {
  expect(SafeUtils.sanitizeBoolean('YES')).toBe(true);
});

/**
 * PASS_SANITIZEBOOLEAN_5: Falsy string coerces to false.
 */
test('PASS_SANITIZEBOOLEAN_5: Falsy string off', () => {
  expect(SafeUtils.sanitizeBoolean('off')).toBe(false);
});

/**
 * FAIL_SANITIZEBOOLEAN_1: Other numbers return null.
 */
test('FAIL_SANITIZEBOOLEAN_1: Other number', () => {
  expect(SafeUtils.sanitizeBoolean(2)).toBeNull();
});

/**
 * FAIL_SANITIZEBOOLEAN_2: NaN returns null.
 */
test('FAIL_SANITIZEBOOLEAN_2: NaN', () => {
  expect(SafeUtils.sanitizeBoolean(NaN)).toBeNull();
});

/**
 * FAIL_SANITIZEBOOLEAN_3: Non-toggle string returns null.
 */
test('FAIL_SANITIZEBOOLEAN_3: Non-toggle string', () => {
  expect(SafeUtils.sanitizeBoolean('maybe')).toBeNull();
});

/**
 * FAIL_SANITIZEBOOLEAN_4: Object input returns null.
 */
test('FAIL_SANITIZEBOOLEAN_4: Object input', () => {
  expect(SafeUtils.sanitizeBoolean({})).toBeNull();
});

/**
 * --------------------------------
 * SECTION: SANITIZEOBJECT TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEOBJECT_1: Basic plain object is preserved.
 */
test('PASS_SANITIZEOBJECT_1: Basic plain object', () => {
  const input = { a: 1, b: 'x' };
  const result = SafeUtils.sanitizeObject(input);
  expect(result).toEqual({ a: 1, b: 'x' });
});

/**
 * PASS_SANITIZEOBJECT_2: Dangerous keys like __proto__ are dropped.
 */
test('PASS_SANITIZEOBJECT_2: Drops dangerous keys', () => {
  const input = { __proto__: 123, a: 1 };
  const result = SafeUtils.sanitizeObject(input);
  expect(result).toEqual({ a: 1 });
});

/**
 * PASS_SANITIZEOBJECT_3: Drops constructor/prototype keys.
 */
test('PASS_SANITIZEOBJECT_3: Drops constructor/prototype', () => {
  const input = { constructor: 1, prototype: 2, x: 3 };
  const result = SafeUtils.sanitizeObject(input);
  expect(result).toEqual({ x: 3 });
});

/**
 * FAIL_SANITIZEOBJECT_1: Non-plain object returns null.
 */
test('FAIL_SANITIZEOBJECT_1: Non-plain object', () => {
  expect(SafeUtils.sanitizeObject(new Date())).toBeNull();
});

/**
 * FAIL_SANITIZEOBJECT_2: Array input returns null.
 */
test('FAIL_SANITIZEOBJECT_2: Array input', () => {
  expect(SafeUtils.sanitizeObject([1, 2])).toBeNull();
});

/**
 * FAIL_SANITIZEOBJECT_3: When all keys are blocked, returns null.
 */
test('FAIL_SANITIZEOBJECT_3: All keys blocked', () => {
  const input = { __proto__: 1, constructor: 2 };
  const result = SafeUtils.sanitizeObject(input);
  expect(result).toBeNull();
});

/**
 * --------------------------------
 * SECTION: SANITIZEEMAIL TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEEMAIL_1: Simple valid email lowercased.
 */
test('PASS_SANITIZEEMAIL_1: Simple valid email', () => {
  const result = SafeUtils.sanitizeEmail('User@Example.com');
  expect(result).toBe('user@example.com');
});

/**
 * PASS_SANITIZEEMAIL_2: Trims spaces around email.
 */
test('PASS_SANITIZEEMAIL_2: Extra spaces trimmed', () => {
  const result = SafeUtils.sanitizeEmail(' a@b.com ');
  expect(result).toBe('a@b.com');
});

/**
 * PASS_SANITIZEEMAIL_3: Multiple @ signs take segment before last.
 */
test('PASS_SANITIZEEMAIL_3: Multiple @ picks middle', () => {
  const result = SafeUtils.sanitizeEmail('x@y@z.com');
  expect(result).toBe('y@z.com');
});

/**
 * PASS_SANITIZEEMAIL_4: Long but within max length passes.
 */
test('PASS_SANITIZEEMAIL_4: Max lengths inside limits', () => {
  const local = 'a'.repeat(64);
  const email = `${local}@example.com`;
  const result = SafeUtils.sanitizeEmail(email);
  expect(result).toBe(email.toLowerCase());
});

/**
 * FAIL_SANITIZEEMAIL_1: Non-string input returns null.
 */
test('FAIL_SANITIZEEMAIL_1: Non-string input', () => {
  expect(SafeUtils.sanitizeEmail(123)).toBeNull();
});

/**
 * FAIL_SANITIZEEMAIL_2: Empty after trim returns null.
 */
test('FAIL_SANITIZEEMAIL_2: Empty after trim', () => {
  expect(SafeUtils.sanitizeEmail(' ')).toBeNull();
});

/**
 * FAIL_SANITIZEEMAIL_3: Missing @ returns null.
 */
test('FAIL_SANITIZEEMAIL_3: Missing @', () => {
  expect(SafeUtils.sanitizeEmail('abc')).toBeNull();
});

/**
 * FAIL_SANITIZEEMAIL_4: Domain ending with dot returns null.
 */
test('FAIL_SANITIZEEMAIL_4: Domain ends with dot', () => {
  expect(SafeUtils.sanitizeEmail('a@b.com.')).toBeNull();
});

/**
 * FAIL_SANITIZEEMAIL_5: Too long local part returns null.
 */
test('FAIL_SANITIZEEMAIL_5: Too long local', () => {
  const local = 'a'.repeat(65);
  const email = `${local}@b.com`;
  expect(SafeUtils.sanitizeEmail(email)).toBeNull();
});

/**
 * FAIL_SANITIZEEMAIL_6: Invalid domain label length returns null.
 */
test('FAIL_SANITIZEEMAIL_6: Domain label invalid length', () => {
  expect(SafeUtils.sanitizeEmail('a@.com')).toBeNull();
});

/**
 * FAIL_SANITIZEEMAIL_7: Non-ASCII character returns null.
 */
test('FAIL_SANITIZEEMAIL_7: Non-ASCII char', () => {
  expect(SafeUtils.sanitizeEmail('ü@ex.com')).toBeNull();
});

/**
 * FAIL_SANITIZEEMAIL_8: Regex failure (no dot) returns null.
 */
test('FAIL_SANITIZEEMAIL_8: Regex fails without dot', () => {
  expect(SafeUtils.sanitizeEmail('a@b')).toBeNull();
});

/**
 * --------------------------------
 * SECTION: SANITIZEPHONE TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEPHONE_1: Valid phone number with formatting characters is normalized.
 */
test('PASS_SANITIZEPHONE_1: Valid phone with formatting normalized', () => {
  const result = SafeUtils.sanitizePhone('(555) 123-4567');
  expect(result).toBe('5551234567');
});

/**
 * PASS_SANITIZEPHONE_2: Phone number with spaces and dashes is normalized.
 */
test('PASS_SANITIZEPHONE_2: Phone with spaces and dashes normalized', () => {
  const result = SafeUtils.sanitizePhone('555 123 4567');
  expect(result).toBe('5551234567');
});

/**
 * PASS_SANITIZEPHONE_3: Phone number with plus prefix is normalized.
 */
test('PASS_SANITIZEPHONE_3: Phone with plus prefix normalized', () => {
  const result = SafeUtils.sanitizePhone('+1 555 123 4567');
  expect(result).toBe('15551234567');
});

/**
 * PASS_SANITIZEPHONE_4: Phone number with dots is normalized.
 */
test('PASS_SANITIZEPHONE_4: Phone with dots normalized', () => {
  const result = SafeUtils.sanitizePhone('555.123.4567');
  expect(result).toBe('5551234567');
});

/**
 * PASS_SANITIZEPHONE_5: Minimum length phone (7 digits) passes.
 */
test('PASS_SANITIZEPHONE_5: Minimum length phone passes', () => {
  const result = SafeUtils.sanitizePhone('1234567');
  expect(result).toBe('1234567');
});

/**
 * PASS_SANITIZEPHONE_6: Maximum length phone (15 digits) passes.
 */
test('PASS_SANITIZEPHONE_6: Maximum length phone passes', () => {
  const result = SafeUtils.sanitizePhone('123456789012345');
  expect(result).toBe('123456789012345');
});

/**
 * PASS_SANITIZEPHONE_7: Phone with leading/trailing whitespace is trimmed.
 */
test('PASS_SANITIZEPHONE_7: Phone with whitespace trimmed', () => {
  const result = SafeUtils.sanitizePhone('  5551234567  ');
  expect(result).toBe('5551234567');
});

/**
 * FAIL_SANITIZEPHONE_1: Non-string input returns null.
 */
test('FAIL_SANITIZEPHONE_1: Non-string input', () => {
  expect(SafeUtils.sanitizePhone(123)).toBeNull();
  expect(SafeUtils.sanitizePhone(null)).toBeNull();
  expect(SafeUtils.sanitizePhone(undefined)).toBeNull();
});

/**
 * FAIL_SANITIZEPHONE_2: Empty string after trim returns null.
 */
test('FAIL_SANITIZEPHONE_2: Empty after trim', () => {
  expect(SafeUtils.sanitizePhone('   ')).toBeNull();
  expect(SafeUtils.sanitizePhone('')).toBeNull();
});

/**
 * FAIL_SANITIZEPHONE_3: Phone with non-digit characters returns null.
 */
test('FAIL_SANITIZEPHONE_3: Phone with non-digits', () => {
  expect(SafeUtils.sanitizePhone('555-ABC-1234')).toBeNull();
  expect(SafeUtils.sanitizePhone('555-123-4ABC')).toBeNull();
});

/**
 * FAIL_SANITIZEPHONE_4: Phone too short (less than 7 digits) returns null.
 */
test('FAIL_SANITIZEPHONE_4: Phone too short', () => {
  expect(SafeUtils.sanitizePhone('123456')).toBeNull();
  expect(SafeUtils.sanitizePhone('12345')).toBeNull();
});

/**
 * FAIL_SANITIZEPHONE_5: Phone too long (more than 15 digits) returns null.
 */
test('FAIL_SANITIZEPHONE_5: Phone too long', () => {
  expect(SafeUtils.sanitizePhone('1234567890123456')).toBeNull();
  expect(SafeUtils.sanitizePhone('12345678901234567')).toBeNull();
});

/**
 * --------------------------------
 * SECTION: SANITIZEIPADDRESS TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEIPADDRESS_1: Valid IPv4 address is normalized.
 */
test('PASS_SANITIZEIPADDRESS_1: Valid IPv4 normalized', () => {
  const result = SafeUtils.sanitizeIpAddress('192.168.1.1');
  expect(result).toBe('192.168.1.1');
});

/**
 * PASS_SANITIZEIPADDRESS_2: IPv4 with valid octets (0-255) passes.
 */
test('PASS_SANITIZEIPADDRESS_2: IPv4 with valid octets', () => {
  expect(SafeUtils.sanitizeIpAddress('0.0.0.0')).toBe('0.0.0.0');
  expect(SafeUtils.sanitizeIpAddress('255.255.255.255')).toBe('255.255.255.255');
  expect(SafeUtils.sanitizeIpAddress('127.0.0.1')).toBe('127.0.0.1');
});

/**
 * PASS_SANITIZEIPADDRESS_3: Valid IPv6 address is normalized to lowercase.
 */
test('PASS_SANITIZEIPADDRESS_3: Valid IPv6 normalized', () => {
  const result = SafeUtils.sanitizeIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  expect(result).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
});

/**
 * PASS_SANITIZEIPADDRESS_4: IPv6 with uppercase hex is lowercased.
 */
test('PASS_SANITIZEIPADDRESS_4: IPv6 uppercase lowercased', () => {
  const result = SafeUtils.sanitizeIpAddress('2001:0DB8:85A3:0000:0000:8A2E:0370:7334');
  expect(result).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
});

/**
 * PASS_SANITIZEIPADDRESS_5: IPv6 with compressed format (::) passes.
 */
test('PASS_SANITIZEIPADDRESS_5: IPv6 compressed format', () => {
  const result = SafeUtils.sanitizeIpAddress('2001:db8::1');
  expect(result).toBe('2001:db8::1');
});

/**
 * PASS_SANITIZEIPADDRESS_6: IP address with leading/trailing whitespace is trimmed.
 */
test('PASS_SANITIZEIPADDRESS_6: IP with whitespace trimmed', () => {
  const result = SafeUtils.sanitizeIpAddress('  192.168.1.1  ');
  expect(result).toBe('192.168.1.1');
});

/**
 * FAIL_SANITIZEIPADDRESS_1: Non-string input returns null.
 */
test('FAIL_SANITIZEIPADDRESS_1: Non-string input', () => {
  expect(SafeUtils.sanitizeIpAddress(123)).toBeNull();
  expect(SafeUtils.sanitizeIpAddress(null)).toBeNull();
  expect(SafeUtils.sanitizeIpAddress(undefined)).toBeNull();
});

/**
 * FAIL_SANITIZEIPADDRESS_2: Empty string after trim returns null.
 */
test('FAIL_SANITIZEIPADDRESS_2: Empty after trim', () => {
  expect(SafeUtils.sanitizeIpAddress('   ')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('')).toBeNull();
});

/**
 * FAIL_SANITIZEIPADDRESS_3: IPv4 with invalid octet (>255) returns null.
 */
test('FAIL_SANITIZEIPADDRESS_3: IPv4 invalid octet', () => {
  expect(SafeUtils.sanitizeIpAddress('256.1.1.1')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('192.300.1.1')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('192.168.999.1')).toBeNull();
});

/**
 * FAIL_SANITIZEIPADDRESS_4: Invalid IPv4 format returns null.
 */
test('FAIL_SANITIZEIPADDRESS_4: Invalid IPv4 format', () => {
  expect(SafeUtils.sanitizeIpAddress('192.168.1')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('192.168.1.1.1')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('192.168')).toBeNull();
});

/**
 * FAIL_SANITIZEIPADDRESS_5: IPv6 with multiple double colons (::) returns null.
 */
test('FAIL_SANITIZEIPADDRESS_5: IPv6 multiple double colons', () => {
  expect(SafeUtils.sanitizeIpAddress('2001::db8::1')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('::1::')).toBeNull();
});

/**
 * FAIL_SANITIZEIPADDRESS_6: Invalid IPv6 format returns null.
 */
test('FAIL_SANITIZEIPADDRESS_6: Invalid IPv6 format', () => {
  expect(SafeUtils.sanitizeIpAddress('2001:db8:1')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('2001::db8::1:2:3:4:5:6:7:8')).toBeNull();
});

/**
 * FAIL_SANITIZEIPADDRESS_7: Neither IPv4 nor IPv6 format returns null.
 */
test('FAIL_SANITIZEIPADDRESS_7: Neither IPv4 nor IPv6', () => {
  expect(SafeUtils.sanitizeIpAddress('not.an.ip.address')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('example.com')).toBeNull();
  expect(SafeUtils.sanitizeIpAddress('12345')).toBeNull();
});

/**
 * --------------------------------
 * SECTION: PARSEARGS TESTS
 * --------------------------------
 */

/**
 * PASS_PARSEARGS_1: Defaults object is returned when input is null.
 */
test('PASS_PARSEARGS_1: Defaults only', () => {
  const result = SafeUtils.parseArgs(null, { a: 1 });
  expect(result).toEqual({ a: 1 });
});

/**
 * PASS_PARSEARGS_2: Parses query string into key/value pairs.
 */
test('PASS_PARSEARGS_2: Query string string', () => {
  const result = SafeUtils.parseArgs('a=1&b=2', {});
  expect(result).toEqual({ a: '1', b: '2' });
});

/**
 * PASS_PARSEARGS_3: Leading question mark is ignored.
 */
test('PASS_PARSEARGS_3: String with leading ?', () => {
  const result = SafeUtils.parseArgs('?a=1', {});
  expect(result).toEqual({ a: '1' });
});

/**
 * PASS_PARSEARGS_4: URLSearchParams input, last value wins.
 */
test('PASS_PARSEARGS_4: URLSearchParams input', () => {
  const usp = new URLSearchParams('a=1&a=2&b=x');
  const result = SafeUtils.parseArgs(usp, {});
  expect(result).toEqual({ a: '2', b: 'x' });
});

/**
 * PASS_PARSEARGS_5: Array of key/value pairs input.
 */
test('PASS_PARSEARGS_5: Array of pairs', () => {
  const input = [
    ['a', '1'],
    ['b', 2],
  ];
  const result = SafeUtils.parseArgs(input, {});
  expect(result).toEqual({ a: '1', b: '2' });
});

/**
 * PASS_PARSEARGS_6: Object input merged with defaults and null preserved.
 */
test('PASS_PARSEARGS_6: Object input merged with defaults', () => {
  const defaults = { c: 1 };
  const input = { a: ' hi ', b: null };
  const result = SafeUtils.parseArgs(input, defaults);
  expect(result).toEqual({ c: 1, a: 'hi', b: null });
});

/**
 * PASS_PARSEARGS_7: Numbers/booleans/null preserved as-is from input.
 */
test('PASS_PARSEARGS_7: Preserves numbers/booleans/null', () => {
  const input = { a: 1, b: true, c: null };
  const result = SafeUtils.parseArgs(input, {});
  expect(result).toEqual({ a: 1, b: true, c: null });
});

/**
 * PASS_PARSEARGS_8: Unsafe keys are skipped when merging.
 */
test('PASS_PARSEARGS_8: Skips unsafe keys', () => {
  const input = {
    __proto__: 1,
    prototype: 2,
    constructor: 3,
    k: 4,
  };
  const result = SafeUtils.parseArgs(input, {});
  expect(result).toEqual({ k: 4 });
});

/**
 * FAIL_PARSEARGS_1: Non-object defaults throw TypeError.
 */
test('FAIL_PARSEARGS_1: Non-object defaults throw', () => {
  expect(() => SafeUtils.parseArgs(null, null)).toThrow(
    'parseArgs(): defaults must be a plain object',
  );
});

/**
 * FAIL_PARSEARGS_2: Defaults as array throw same TypeError.
 */
test('FAIL_PARSEARGS_2: Defaults array throws', () => {
  expect(() => SafeUtils.parseArgs(null, [])).toThrow(
    'parseArgs(): defaults must be a plain object',
  );
});

/**
 * FAIL_PARSEARGS_3: Unsupported input type returns defaults without throwing.
 */
test('FAIL_PARSEARGS_3: Unsupported input type', () => {
  const result = SafeUtils.parseArgs(123, {});
  expect(result).toEqual({});
});

/**
 * --------------------------------
 * SECTION: PARSEURL TESTS
 * --------------------------------
 */

/**
 * PASS_PARSEURL_1: Absolute URL parsed into full object.
 */
test('PASS_PARSEURL_1: Absolute URL full object', () => {
  const url = 'https://ex.com:8080/p?q=1#frag';
  const result = SafeUtils.parseUrl(url);
  expect(result).toEqual({
    scheme: 'https',
    host: 'ex.com',
    port: 8080,
    path: '/p',
    query: 'q=1',
    fragment: 'frag',
  });
});

/**
 * PASS_PARSEURL_2: Relative URL returns object with empty scheme/host.
 */
test('PASS_PARSEURL_2: Relative URL object', () => {
  const url = '/p?q=1#f';
  const result = SafeUtils.parseUrl(url);
  expect(result).toEqual({
    scheme: '',
    host: '',
    port: null,
    path: '/p',
    query: 'q=1',
    fragment: 'f',
  });
});

/**
 * PASS_PARSEURL_3: Component "path" is returned for relative URL.
 */
test('PASS_PARSEURL_3: Component path', () => {
  const url = '/foo';
  const result = SafeUtils.parseUrl(url, 'path');
  expect(result).toBe('/foo');
});

/**
 * PASS_PARSEURL_4: Component "scheme" for absolute URL.
 */
test('PASS_PARSEURL_4: Absolute scheme component', () => {
  const url = 'http://ex.com';
  const result = SafeUtils.parseUrl(url, 'scheme');
  expect(result).toBe('http');
});

/**
 * PASS_PARSEURL_5: Relative URL "foo" allowed when requesting path.
 */
test('PASS_PARSEURL_5: Relative URL with path component', () => {
  const url = 'foo';
  const result = SafeUtils.parseUrl(url, 'path');
  expect(result).toBe('foo');
});

/**
 * FAIL_PARSEURL_1: Non-string or empty input returns false.
 */
test('FAIL_PARSEURL_1: Non-string or empty', () => {
  expect(SafeUtils.parseUrl(123)).toBe(false);
  expect(SafeUtils.parseUrl('')).toBe(false);
});

/**
 * FAIL_PARSEURL_2: Overlong input returns false.
 */
test('FAIL_PARSEURL_2: Overlong input', () => {
  const longInput = 'a'.repeat(4097);
  expect(SafeUtils.parseUrl(longInput)).toBe(false);
});

/**
 * FAIL_PARSEURL_3: Control character in input returns false.
 */
test('FAIL_PARSEURL_3: Control character in input', () => {
  const url = 'http://ex.com/' + String.fromCharCode(0);
  expect(SafeUtils.parseUrl(url)).toBe(false);
});

/**
 * FAIL_PARSEURL_4: Relative URL asking for host returns false.
 */
test('FAIL_PARSEURL_4: Relative URL host component', () => {
  expect(SafeUtils.parseUrl('/foo', 'host')).toBe(false);
});

/**
 * FAIL_PARSEURL_5: Invalid component name returns false.
 */
test('FAIL_PARSEURL_5: Invalid component name', () => {
  expect(SafeUtils.parseUrl('http://ex.com', 'bogus')).toBe(false);
});

/**
 * FAIL_PARSEURL_6: Parsing error returns false.
 */
test('FAIL_PARSEURL_6: Parsing throws', () => {
  expect(SafeUtils.parseUrl('http://\uD800')).toBe(false);
});

/**
 * --------------------------------
 * SECTION: ADDQUERYARG TESTS
 * --------------------------------
 */

/**
 * PASS_ADDQUERYARG_1: Adds a single parameter to URL.
 */
test('PASS_ADDQUERYARG_1: Single param add', () => {
  const result = SafeUtils.addQueryArg('foo', 'bar', 'https://ex.com');
  expect(result).toBe('https://ex.com/?foo=bar');
});

/**
 * PASS_ADDQUERYARG_2: Updates existing parameter value.
 */
test('PASS_ADDQUERYARG_2: Update existing param', () => {
  const result = SafeUtils.addQueryArg('foo', 'bar', 'https://ex.com/?foo=old');
  expect(result).toBe('https://ex.com/?foo=bar');
});

/**
 * PASS_ADDQUERYARG_3: Deletes parameter when value is null.
 */
test('PASS_ADDQUERYARG_3: Delete param with null value', () => {
  const result = SafeUtils.addQueryArg('foo', null, 'https://ex.com/?foo=1&bar=2');
  expect(result).toBe('https://ex.com/?bar=2');
});

/**
 * PASS_ADDQUERYARG_4: Object params variant merges into URL.
 */
test('PASS_ADDQUERYARG_4: Params object variant', () => {
  const result = SafeUtils.addQueryArg({ a: 1, b: null }, 'https://ex.com/?b=2');
  expect(result).toBe('https://ex.com/?a=1');
});

/**
 * PASS_ADDQUERYARG_5: Numeric key treated as string.
 */
test('PASS_ADDQUERYARG_5: Non-string key numeric', () => {
  const result = SafeUtils.addQueryArg(1, 'v', 'https://ex.com');
  expect(result).toBe('https://ex.com/?1=v');
});

/**
 * FAIL_ADDQUERYARG_1: Invalid key type returns original URL unchanged.
 */
test('FAIL_ADDQUERYARG_1: Invalid key type', () => {
  const url = 'https://ex.com';
  const result = SafeUtils.addQueryArg(true, 'x', url);
  expect(result).toBe(url);
});

/**
 * FAIL_ADDQUERYARG_2: Malformed URL in apply returns original string.
 */
test('FAIL_ADDQUERYARG_2: Malformed URL', () => {
  const url = 'not a url';
  const result = SafeUtils.addQueryArg('a', 'b', url);
  expect(result).toBe(url);
});

/**
 * FAIL_ADDQUERYARG_3: Non-object keyOrParams treated as key without throwing.
 */
test('FAIL_ADDQUERYARG_3: Scalar key branch behaves', () => {
  const result = SafeUtils.addQueryArg('foo', { bar: 1 }, 'https://ex.com');
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
});

/**
 * --------------------------------
 * SECTION: GETARRAYTYPE TESTS
 * --------------------------------
 */

/**
 * PASS_GETARRAYTYPE_1: Homogeneous number array returns "number[]".
 */
test('PASS_GETARRAYTYPE_1: Homogeneous number array', () => {
  expect(SafeUtils.getArrayType([1, 2, 3])).toBe('number[]');
});

/**
 * PASS_GETARRAYTYPE_2: Homogeneous string array returns "string[]".
 */
test('PASS_GETARRAYTYPE_2: Homogeneous string array', () => {
  expect(SafeUtils.getArrayType(['a', 'b'])).toBe('string[]');
});

/**
 * PASS_GETARRAYTYPE_3: Mixed types return "mixed[]".
 */
test('PASS_GETARRAYTYPE_3: Mixed types', () => {
  expect(SafeUtils.getArrayType([1, 'a'])).toBe('mixed[]');
});

/**
 * PASS_GETARRAYTYPE_4: Empty array returns "mixed[]".
 */
test('PASS_GETARRAYTYPE_4: Empty array', () => {
  expect(SafeUtils.getArrayType([])).toBe('mixed[]');
});

/**
 * PASS_GETARRAYTYPE_5: Nested homogeneous arrays return "number[][]".
 */
test('PASS_GETARRAYTYPE_5: Nested homogeneous arrays', () => {
  const arr = [
    [1, 2],
    [3],
  ];
  expect(SafeUtils.getArrayType(arr)).toBe('number[][]');
});

/**
 * PASS_GETARRAYTYPE_6: Nested mixed arrays return "mixed[]".
 */
test('PASS_GETARRAYTYPE_6: Nested mixed arrays', () => {
  const arr = [
    [1, 'a'],
    [2],
  ];
  expect(SafeUtils.getArrayType(arr)).toBe('mixed[]');
});

/**
 * FAIL_GETARRAYTYPE_1: Non-array input throws TypeError.
 */
test('FAIL_GETARRAYTYPE_1: Non-array input', () => {
  expect(() => SafeUtils.getArrayType(123)).toThrow(
    'getArrayType(): expected an array input',
  );
});

/**
 * --------------------------------
 * SECTION: FORMATERROR TESTS
 * --------------------------------
 */

/**
 * PASS_FORMATERROR_1: Basic message formats as TypeError with method name.
 */
test('PASS_FORMATERROR_1: Basic message', () => {
  const err = SafeUtils.formatError('foo', 'bar');
  expect(err).toBeInstanceOf(TypeError);
  expect(err.message).toBe('foo(): bar');
});

/**
 * PASS_FORMATERROR_2: Non-string args are coerced to strings.
 */
test('PASS_FORMATERROR_2: Non-string args coerced', () => {
  const err = SafeUtils.formatError(123, true);
  expect(err).toBeInstanceOf(TypeError);
  expect(err.message).toBe('123(): true');
});

/**
 * FAIL_FORMATERROR_1: Calling formatError does not throw and returns instance.
 */
test('FAIL_FORMATERROR_1: Does not throw, returns instance', () => {
  const err = SafeUtils.formatError('foo', 'bar');
  expect(err).toBeInstanceOf(TypeError);
  expect(err.message).toBe('foo(): bar');
});

/**
 * --------------------------------
 * SECTION: SANITIZEHTMLWITHWHITELIST TESTS
 * --------------------------------
 */

/**
 * PASS_SANITIZEHTML_1: Allowed tags are preserved with structure.
 */
test('PASS_SANITIZEHTML_1: Allowed tags preserved', () => {
  const input = '<p>Hi <strong>there</strong></p>';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input);
  expect(result).toContain('<p>');
  expect(result).toContain('</p>');
  expect(result).toContain('<strong>');
  expect(result).toContain('</strong>');
  expect(result).toContain('Hi');
  expect(result).toContain('there');
});

/**
 * PASS_SANITIZEHTML_2: Disallowed tags are replaced with their text content.
 */
test('PASS_SANITIZEHTML_2: Disallowed tag replaced with text', () => {
  const input = '<script>alert(1)</script>Text';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input);
  expect(result).toContain('alert(1)');
  expect(result).toContain('Text');
  expect(result).not.toContain('<script');
});

/**
 * PASS_SANITIZEHTML_3: Attributes are filtered based on whitelist.
 */
test('PASS_SANITIZEHTML_3: Attributes filtered', () => {
  const input =
    '<a href="http://ex.com" onclick="x" rel="nofollow">x</a>';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input);
  expect(result).toContain('<a');
  expect(result).toContain('href="http://ex.com"');
  expect(result).toContain('rel="nofollow"');
  expect(result).not.toContain('onclick=');
});

/**
 * PASS_SANITIZEHTML_4: Anchor href sanitized and dangerous URLs replaced with text.
 */
test('PASS_SANITIZEHTML_4: Anchor href sanitized', () => {
  const input = '<a href="javascript:alert(1)">x</a>';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input);
  expect(result).toBe('x');
});

/**
 * PASS_SANITIZEHTML_5: _blank target gets rel="noopener noreferrer".
 */
test('PASS_SANITIZEHTML_5: _blank target rel set', () => {
  const input = '<a href="http://ex.com" target="_blank">x</a>';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input);
  expect(result).toContain('href="http://ex.com"');
  expect(result).toContain('target="_blank"');
  expect(result).toContain('rel="noopener noreferrer"');
});

/**
 * PASS_SANITIZEHTML_6: escapeChars escapes quotes in text nodes only.
 */
test('PASS_SANITIZEHTML_6: escapeChars escapes quotes in text', () => {
  const input = '"<p>He said "hi"</p>"';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input, true);
  expect(result).toContain('&quot;');
  expect(result).toContain('<p>He said &quot;hi&quot;</p>');
});

/**
 * PASS_SANITIZEHTML_7: Comments are removed from output.
 */
test('PASS_SANITIZEHTML_7: Comments removed', () => {
  const input = '<p>Hi<!-- comment --></p>';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input);
  expect(result).toBe('<p>Hi</p>');
});

/**
 * PASS_SANITIZEHTML_8: Fallback behavior when jsdom is forcibly unavailable.
 * Uses jest.doMock to simulate missing jsdom even when it is installed.
 */
test('PASS_SANITIZEHTML_8: Fallback when jsdom missing', (done) => {
  jest.isolateModules(() => {
    jest.doMock('jsdom', () => {
      throw new Error('Mock jsdom load failure');
    });
    const localSafeUtils = require(path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'utils',
      'SafeUtils.js',
    ));
    const result = localSafeUtils.sanitizeHtmlWithWhitelist('<b>x</b>');
    expect(result).toBe('x');
    jest.dontMock('jsdom');
    done();
  });
});

/**
 * FAIL_SANITIZEHTML_1: Non-string input returns empty string.
 */
test('FAIL_SANITIZEHTML_1: Non-string input', () => {
  expect(SafeUtils.sanitizeHtmlWithWhitelist(123)).toBe('');
});

/**
 * FAIL_SANITIZEHTML_2: Empty string input returns empty string.
 */
test('FAIL_SANITIZEHTML_2: Empty string', () => {
  expect(SafeUtils.sanitizeHtmlWithWhitelist('')).toBe('');
});

/**
 * FAIL_SANITIZEHTML_3: Dangerous URL plus _blank replaced with text.
 */
test('FAIL_SANITIZEHTML_3: Dangerous URL plus _blank', () => {
  const input =
    '<a href="javascript:alert(1)" target="_blank">x</a>';
  const result = SafeUtils.sanitizeHtmlWithWhitelist(input);
  expect(result).toBe('x');
});

/**
 * PASS_SANITATEVALIDATE_PIPELINE_1:
 * Default pipeline is assumed to be "method" when not provided.
 */
test('PASS_SANITATEVALIDATE_PIPELINE_1: Default pipeline is method', () => {
  const schema = {
    a: { type: 'int', required: true },
  };

  expect(() =>
    SafeUtils.sanitizeValidate(schema),
  ).toThrow('(pipeline: method)');
});

/**
 * PASS_SANITATEVALIDATE_PIPELINE_2:
 * Explicit pipeline "entry" is reflected in thrown error.
 */
/**
 * --------------------------------
 * SECTION: GETVALIDATIONERROR TESTS
 * --------------------------------
 */

/**
 * PASS_GETVALIDATIONERROR_1: Returns structured error object with all fields
 */
test('PASS_GETVALIDATIONERROR_1: Returns structured error object with all fields', () => {
  const result = SafeUtils.getValidationError('fieldName', 'invalidValue', 'int', 'Not a valid integer');
  
  expect(result).toEqual({
    field: 'fieldName',
    value: 'invalidValue',
    type: 'int',
    reason: 'Not a valid integer'
  });
});

/**
 * PASS_GETVALIDATIONERROR_2: Handles empty/null inputs with defaults
 */
test('PASS_GETVALIDATIONERROR_2: Handles empty/null inputs with defaults', () => {
  const result1 = SafeUtils.getValidationError(null, null, null, null);
  expect(result1.field).toBe('');
  expect(result1.type).toBe('');
  expect(result1.reason).toBe('Validation failed');
  
  const result2 = SafeUtils.getValidationError('', '', '', '');
  expect(result2.field).toBe('');
  expect(result2.type).toBe('');
  expect(result2.reason).toBe('Validation failed');
});

/**
 * PASS_GETVALIDATIONERROR_3: Converts non-string inputs to strings
 */
test('PASS_GETVALIDATIONERROR_3: Converts non-string inputs to strings', () => {
  const result = SafeUtils.getValidationError(123, { obj: true }, 456, 789);
  
  expect(result.field).toBe('123');
  expect(result.type).toBe('456');
  expect(result.reason).toBe('789');
  expect(result.value).toEqual({ obj: true });
});

/**
 * --------------------------------
 * SECTION: VALIDATEWITHDETAILS TESTS
 * --------------------------------
 */

/**
 * PASS_VALIDATEWITHDETAILS_1: Valid integer returns success
 */
test('PASS_VALIDATEWITHDETAILS_1: Valid integer returns success', () => {
  const result = SafeUtils.validateWithDetails('123', 'int', 'age');
  
  expect(result.valid).toBe(true);
  expect(result.value).toBe(123);
  expect(result.error).toBeNull();
});

/**
 * PASS_VALIDATEWITHDETAILS_2: Invalid integer returns error details
 */
test('PASS_VALIDATEWITHDETAILS_2: Invalid integer returns error details', () => {
  const result = SafeUtils.validateWithDetails('abc', 'int', 'age');
  
  expect(result.valid).toBe(false);
  expect(result.value).toBeNull();
  expect(result.error).toBeDefined();
  expect(result.error.field).toBe('age');
  expect(result.error.type).toBe('int');
  expect(result.error.reason).toContain('not a valid integer');
});

/**
 * PASS_VALIDATEWITHDETAILS_3: Valid float returns success
 */
test('PASS_VALIDATEWITHDETAILS_3: Valid float returns success', () => {
  const result = SafeUtils.validateWithDetails('123.45', 'float', 'price');
  
  expect(result.valid).toBe(true);
  expect(result.value).toBe(123.45);
  expect(result.error).toBeNull();
});

/**
 * PASS_VALIDATEWITHDETAILS_4: Valid boolean returns success
 */
test('PASS_VALIDATEWITHDETAILS_4: Valid boolean returns success', () => {
  const result = SafeUtils.validateWithDetails('true', 'bool', 'enabled');
  
  expect(result.valid).toBe(true);
  expect(result.value).toBe(true);
  expect(result.error).toBeNull();
});

/**
 * PASS_VALIDATEWITHDETAILS_5: Valid email returns success
 */
test('PASS_VALIDATEWITHDETAILS_5: Valid email returns success', () => {
  const result = SafeUtils.validateWithDetails('test@example.com', 'email', 'email');
  
  expect(result.valid).toBe(true);
  expect(result.value).toBe('test@example.com');
  expect(result.error).toBeNull();
});

/**
 * PASS_VALIDATEWITHDETAILS_6: Valid phone returns success
 */
test('PASS_VALIDATEWITHDETAILS_6: Valid phone returns success', () => {
  const result = SafeUtils.validateWithDetails('5551234567', 'phone', 'phone');
  
  expect(result.valid).toBe(true);
  expect(result.value).toBe('5551234567');
  expect(result.error).toBeNull();
});

/**
 * PASS_VALIDATEWITHDETAILS_7: Valid IP address returns success
 */
test('PASS_VALIDATEWITHDETAILS_7: Valid IP address returns success', () => {
  const result = SafeUtils.validateWithDetails('192.168.1.1', 'ip', 'ipAddress');
  
  expect(result.valid).toBe(true);
  expect(result.value).toBe('192.168.1.1');
  expect(result.error).toBeNull();
});

/**
 * PASS_VALIDATEWITHDETAILS_8: Unknown type returns error
 */
test('PASS_VALIDATEWITHDETAILS_8: Unknown type returns error', () => {
  const result = SafeUtils.validateWithDetails('value', 'unknownType', 'field');
  
  expect(result.valid).toBe(false);
  expect(result.value).toBeNull();
  expect(result.error).toBeDefined();
  expect(result.error.reason).toContain('Unknown validation type');
});

/**
 * PASS_VALIDATEWITHDETAILS_9: Uses default field name when not provided
 */
test('PASS_VALIDATEWITHDETAILS_9: Uses default field name when not provided', () => {
  const result = SafeUtils.validateWithDetails('abc', 'int');
  
  expect(result.error.field).toBe('field');
});

/**
 * PASS_VALIDATEWITHDETAILS_10: Handles validation exceptions gracefully
 */
test('PASS_VALIDATEWITHDETAILS_10: Handles validation exceptions gracefully', () => {
  // This tests that exceptions during validation are caught and returned as error details
  const result = SafeUtils.validateWithDetails(null, 'int', 'testField');
  
  expect(result.valid).toBe(false);
  expect(result.error).toBeDefined();
  expect(result.error.field).toBe('testField');
});

test('PASS_SANITATEVALIDATE_PIPELINE_2: Entry pipeline reflected in error', () => {
  const schema = {
    a: { type: 'int', required: true },
  };

  expect(() =>
    SafeUtils.sanitizeValidate(schema, 'entry'),
  ).toThrow('(pipeline: entry)');
});


