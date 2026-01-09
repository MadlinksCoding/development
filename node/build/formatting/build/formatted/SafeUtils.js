/*
 * Methods:
 *    hasValue() — Determine value presence.
 *    sanitizeValidate() — Sanitize and validate schema inputs.
 *    sanitizeUrl() — Normalize and validate URLs.
 *    sanitizeTextField() — Strip tags from text safely.
 *    escUrl() — Escape and serialize URLs safely.
 *    sanitizeArray() — Coerce inputs into arrays.
 *    sanitizeIterable() — Sanitize iterable collections.
 *    sanitizeString() — Create a trimmed escaped string.
 *    isPlainObject() — Detect plain objects safely.
 *    escapeHtmlEntities() — Escape HTML entities safely.
 *    escapeHtmlQuotes() — Escape only HTML quotes.
 *    sanitizeInteger() — Parse safe integers.
 *    sanitizeFloat() — Parse safe floats.
 *    sanitizeBoolean() — Coerce boolean values safely.
 *    sanitizeObject() — Sanitize plain objects safely.
 *    sanitizeEmail() — Normalize and validate email.
 *    parseArgs() — Merge entries into defaults safely.
 *    parseUrl() — Parse a URL into parts.
 *    addQueryArg() — Add or update query arguments.
 *    getArrayType() — Infer array element type.
 *    formatError() — Format error message.
 *    sanitizeHtmlWithWhitelist() — Sanitize HTML with a whitelist.
 */

"use strict";

/**
 * Class SafeUtils
 *
 * A collection of defensive sanitizers, parsers, and helpers for safely handling untrusted inputs.
 *
 * @link #TODO
 */
class SafeUtils {
  // Global debug flag to enable noisy logs in utility functions when needed.
  // Default is false to avoid polluting production logs.
  static DEBUG = false;
  /**
   * Determine value presence.
   *
   * Checks whether the provided value should count as present across strings, numbers, arrays, and objects.
   * Note: 0 and false are considered present
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#hasValue #TODO
   *
   * @param {*} inputCandidate - Value to test for presence.
   * @returns {boolean} Indicator that the value is considered present.
   */
  static hasValue(inputCandidate) {
    // Check if value is null or undefined
    if (inputCandidate === null || inputCandidate === undefined)
      // Return false when value is missing
      return false;
    // Check if value is a string
    if (typeof inputCandidate === "string")
      // Return whether trimmed string is non-empty
      return inputCandidate.trim().length > 0;
    // Check if value is a number
    if (typeof inputCandidate === "number")
      // Return whether number is not NaN
      return !Number.isNaN(inputCandidate);
    // Check if value is an array
    if (Array.isArray(inputCandidate))
      // Return whether array contains elements
      return inputCandidate.length > 0;
    // Check if value is an object
    if (typeof inputCandidate === "object") {
      // Assemble own property keys array
      const ownPropertyKeys = [
        // Include string-keyed properties
        ...Object.getOwnPropertyNames(inputCandidate),
        // Include symbol-keyed properties
        ...Object.getOwnPropertySymbols(inputCandidate),
      ];
      // Return false when there are no own keys
      if (ownPropertyKeys.length === 0) return false;
      // Determine if any property value is present
      return ownPropertyKeys.some((propertyKey) => {
        // Capture the current property value
        const propertyValue = inputCandidate[propertyKey];
        // Return whether the property value is defined
        return propertyValue !== null && propertyValue !== undefined;
      });
    }
    // Return true when value passes earlier checks
    return true;
  }

  /**
   * Sanitize and validate schema inputs.
   *
   * Applies type-specific sanitizers per rule to ensure final values match expected shapes.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeValidate #TODO
   *
   * @param {Object} validationSchema - Schema map defining value, type, and requirements.
   * @param {Object} providedArguments - Argument values keyed by schema fields.
   * @param {string} pipeline - Pipeline label for error context.
   * @returns {Object} Object of sanitized values keyed by schema keys.
   */
  static sanitizeValidate(
    validationSchema = {},
    providedArguments = {},
    pipeline = "method",
  ) {
    // Return early when payload has already been validated
    if (providedArguments && providedArguments.__validated === true)
      // Return provided args when already validated
      return providedArguments;
    // Define helper for plain object checks
    const isPlainObjectCheck = (candidate) =>
      SafeUtils.isPlainObject(candidate);
    // Validate that schema is a plain object
    if (!isPlainObjectCheck(validationSchema)) {
      // Throw formatted error when schema is invalid
      throw SafeUtils.formatError(
        "sanitizeValidate",
        `schema must be a plain object (pipeline: ${pipeline})`,
      );
    }
    // Define mapping of types to sanitizers
    const typeToSanitizerMap = {
      // Map int type to integer sanitizer
      int: SafeUtils.sanitizeInteger,
      // Map integer alias to integer sanitizer
      integer: SafeUtils.sanitizeInteger,
      // Map float type to float sanitizer
      float: SafeUtils.sanitizeFloat,
      // Map numeric alias to float sanitizer
      numeric: SafeUtils.sanitizeFloat,
      // Map bool alias to boolean sanitizer
      bool: SafeUtils.sanitizeBoolean,
      // Map boolean alias to boolean sanitizer
      boolean: SafeUtils.sanitizeBoolean,
      // Map string type to text field sanitizer
      string: SafeUtils.sanitizeTextField,
      // Map text alias to text field sanitizer
      text: SafeUtils.sanitizeTextField,
      // Map array type to array sanitizer
      array: SafeUtils.sanitizeArray,
      // Map iterable type to iterable sanitizer
      iterable: SafeUtils.sanitizeIterable,
      // Map email type to email sanitizer
      email: SafeUtils.sanitizeEmail,
      // Map url type to URL sanitizer
      url: SafeUtils.sanitizeUrl,
      // Map html type to whitelist sanitizer
      html: SafeUtils.sanitizeHtmlWithWhitelist,
      // Map object type to object sanitizer
      object: SafeUtils.sanitizeObject,
    };
    // Prepare sanitized output container
    const sanitizedResults = {};
    // Iterate over schema entries
    for (const [fieldName, fieldRule] of Object.entries(validationSchema)) {
      // Ensure each schema rule is a plain object with a type string
      if (
        !isPlainObjectCheck(fieldRule) ||
        typeof fieldRule.type !== "string"
      ) {
        // Throw when schema rule structure is invalid
        throw new TypeError(
          // Describe invalid schema rule
          `sanitizeValidate(): invalid schema for "${fieldName}" (pipeline: ${pipeline})`,
        );
      }
      // Destructure metadata from the schema rule
      const { type, required = false, default: defaultValue } = fieldRule;
      // Capture the provided value from args
      const submittedValue =
        fieldName in providedArguments
          ? providedArguments[fieldName]
          : undefined;
      // Lookup sanitizer based on declared type
      const fieldSanitizer = typeToSanitizerMap[type.toLowerCase()];
      // Ensure the sanitizer is callable
      if (typeof fieldSanitizer !== "function") {
        // Throw when the declared type is unknown
        throw new TypeError(
          // Describe missing sanitizer type
          `sanitizeValidate(): unknown type "${type}" for "${fieldName}" (pipeline: ${pipeline})`,
        );
      }
      // Handle optional values that are absent
      if (!required && !SafeUtils.hasValue(submittedValue)) {
        // Apply default when provided
        if ("default" in fieldRule) {
          // Sanitize the default entry
          const sanitizedDefaultFieldValue = fieldSanitizer(defaultValue);
          // Ensure the sanitized default is present
          if (!SafeUtils.hasValue(sanitizedDefaultFieldValue)) {
            // Throw when default sanitization fails
            throw new TypeError(
              // Describe invalid default
              `sanitizeValidate(): "${fieldName}" has invalid default for type ${type} (pipeline: ${pipeline})`,
            );
          }
          // Assign sanitized default to output storage
          sanitizedResults[fieldName] = sanitizedDefaultFieldValue;
          // Handle missing default by setting null
        } else {
          // Assign null for absent optional defaults
          sanitizedResults[fieldName] = null;
        }
        // Continue to next schema rule when optional value absent
        continue;
      }
      // Enforce presence for required values
      if (required && !SafeUtils.hasValue(submittedValue)) {
        // Allow iterables to be handled by their sanitizer
        if (type.toLowerCase() === "iterable") {
          // Continue without throwing for iterables
          // Throw for other missing required parameters
        } else {
          // Throw when required parameter is missing
          throw new TypeError(
            // Describe failed sanitization
            `Missing required parameter: ${fieldName} (pipeline: ${pipeline})`,
          );
        }
      }
      // Sanitize the provided value
      const sanitizedFieldValue = fieldSanitizer(submittedValue);
      // Reject null sanitization outcomes
      if (sanitizedFieldValue === null) {
        // Throw when sanitization nulls out the value
        throw new TypeError(
          // Describe failed sanitization
          `sanitizeValidate(): "${fieldName}" failed sanitization. Expected ${type}. (pipeline: ${pipeline})`,
        );
      }
      // Store the sanitized value
      sanitizedResults[fieldName] = sanitizedFieldValue;
    }
    // Mark output as validated for downstream calls
    Object.defineProperty(sanitizedResults, "__validated", {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    // Return the assembled sanitized output
    return sanitizedResults;
  }

  /**
   * Normalize and validate URLs.
   *
   * Accepts only safe schemes, enforces length limits, and returns a normalized href when valid.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeUrl #TODO
   *
   * @param {string} rawUrl - Raw URL string to validate.
   * @returns {string|null} Normalized URL string or null if invalid.
   */
  static sanitizeUrl(rawUrl) {
    // Return null when input is not a string
    if (typeof rawUrl !== "string") return null;
    // Reject URLs that contain control characters upfront
    if (/[\u0000-\u001F\u007F]/.test(rawUrl)) return null;
    // Inspect authority portion for non-ASCII hostnames
    const authorityMatch = rawUrl.match(/^[^:]+:\/\/([^\/?#]+)/);
    // When authority exists validate the raw host portion
    if (authorityMatch) {
      // Extract the authority host segment
      const authorityHostSegment = authorityMatch[1];
      // Reject non-ASCII characters in the authority host
      if (/[^\x00-\x7F]/.test(authorityHostSegment)) {
        // Log warning when DEBUG mode is enabled
        if (SafeUtils.DEBUG) {
          // Log parse warning with error detail
          console.warn(
            // Provide debug warning message
            "sanitizeUrl parsing error",
            // Provide rejection reason
            new TypeError("Non-ASCII hostname rejected"),
          );
        }
        // Return null for invalid authority hosts
        return null;
      }
    }
    // Attempt to parse the value as a URL
    try {
      // Create a URL instance from input
      const parsedUrl = new URL(rawUrl);
      // Reject protocols that are not http or https
      if (!["http:", "https:"].includes(parsedUrl.protocol)) return null;
      // Clear username portion of the URL
      parsedUrl.username = "";
      // Clear password portion of the URL
      parsedUrl.password = "";
      // Reject hostnames with trailing dot
      if (parsedUrl.hostname.endsWith(".")) return null;
      // Reject non-ASCII characters in the parsed hostname
      if (/[^\x00-\x7F]/.test(parsedUrl.hostname)) return null;
      // Convert the parsed URL back to string
      const normalizedUrl = parsedUrl.toString();
      // Reject URLs that exceed the maximum length
      if (normalizedUrl.length > 2048) return null;
      // Reject normalized URLs containing control characters
      if (/[\u0000-\u001F\u007F]/.test(normalizedUrl)) return null;
      // Return the sanitized URL string
      return normalizedUrl;
      // Catch parsing errors
    } catch (e) {
      // Warn when URL parsing fails and DEBUG is enabled
      if (SafeUtils.DEBUG) {
        // Log parsing failure details
        console.warn(
          // Provide catch warning message
          "sanitizeUrl parsing error",
          // Provide caught error object
          e,
        );
      }
      // Return null when parsing failed
      return null;
    }
  }

  /**
   * Strip tags from text safely.
   *
   * Trims input, removes HTML/control characters, and optionally HTML-escapes the result.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeTextField #TODO
   *
   * @param {string} inputText - Input text to sanitize.
   * @param {boolean} [shouldEscapeHtml=false] - Whether to HTML-escape reserved characters.
   * @returns {string|null} Cleaned string or null when empty or invalid.
   */
  static sanitizeTextField(inputText, shouldEscapeHtml = false) {
    // Return null when input is not a string
    if (typeof inputText !== "string") return null;
    // Strip HTML tags from input
    let cleanedText = inputText.replace(/<[^>]*>/g, "");
    // Remove zero-width and formatting characters
    cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, "");
    // Remove control characters except newline and tab
    cleanedText = cleanedText.replace(
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g,
      "",
    );
    // Trim spaces while preserving newline and tab characters
    cleanedText = cleanedText.replace(/^[ \f\v]+|[ \f\v]+$/g, "");
    // Attempt to normalize string to NFC form
    try {
      // Normalize the string
      cleanedText = cleanedText.normalize("NFC");
      // Catch normalization errors
    } catch {
      // Ignore normalization failures
    }
    // Optionally HTML-escape special characters
    if (shouldEscapeHtml) {
      // Escape HTML entities safely
      cleanedText = SafeUtils.sanitizeString(cleanedText, true);
    }
    // Return sanitized string or null when empty
    return cleanedText.length ? cleanedText : null;
  }

  /**
   * Escape and serialize URLs safely.
   *
   * Validates allowed protocols, strips credentials, and returns an encoded URL string or empty string.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#escUrl #TODO
   *
   * @param {string} rawUrl - Raw URL (absolute or relative).
   * @param {string[]} [protocolAllowlist=["http:", "https:"]] - Whitelisted protocols.
   * @returns {string} Safely escaped URL string or empty string when invalid.
   */
  static escUrl(rawUrl, protocolAllowlist = ["http:", "https:"]) {
    // Return empty string when input is not a non-empty string
    if (typeof rawUrl !== "string" || rawUrl.length === 0) return "";
    // Reject percent-encoded control characters
    if (
      /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff]|8[0-9A-Fa-f]|9[0-9A-Fa-f])/.test(
        rawUrl,
      )
    )
      return "";
    // Attempt to parse and sanitize the URL input
    try {
      // Handle relative-looking inputs without a scheme
      if (/^(\/|\?|#|\.\/|\.\.\/)/.test(rawUrl)) {
        // Reject relative inputs containing control characters
        if (/[\u0000-\u001F\u007F]/.test(rawUrl)) return "";
        // Preserve the original relative input
        return rawUrl;
      }
      // Create URL object with a dummy base to support relative paths
      const parsedUrlObject = new URL(rawUrl, "http://_base_/");
      // Reject protocols outside the allowed set
      if (!protocolAllowlist.includes(parsedUrlObject.protocol)) return "";
      // Process absolute URLs when origin is present
      if (parsedUrlObject.origin !== "null") {
        // Remove username information
        parsedUrlObject.username = "";
        // Remove password information
        parsedUrlObject.password = "";
        // Return sanitized absolute URL string
        return parsedUrlObject.toString();
      }
      // Handle relative URLs when parsing yields null origin
      const relativeInput = rawUrl;
      // Reject relative input with control characters
      if (/[\u0000-\u001F\u007F]/.test(relativeInput)) return "";
      // Return the sanitized relative input
      return relativeInput;
      // Catch parsing failures
    } catch {
      // Return empty string when parsing fails
      return "";
    }
  }

  /**
   * Coerce inputs into arrays.
   *
   * Ensures an array result and filters out null, undefined, or empty values via hasValue().
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeArray #TODO
   *
   * @param {*} rawInputValue - Any input to coerce into an array.
   * @returns {Array} Cleaned array of present values.
   */
  static sanitizeArray(rawInputValue) {
    // Return empty array when input is null or undefined
    if (rawInputValue == null) return [];
    // Create normalized array by wrapping non-array inputs
    const normalizedValuesArray = Array.isArray(rawInputValue)
      ? rawInputValue
      : [rawInputValue];
    // Filter normalized array to include only present values
    return normalizedValuesArray.filter((arrayEntryValue) =>
      SafeUtils.hasValue(arrayEntryValue),
    );
  }

  /**
   * Sanitize iterable collections.
   *
   * Attempts to convert an iterable to an array and filters out invalid values, returning null on failure.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeIterable #TODO
   *
   * @param {Iterable} iterableCandidate - The iterable value to sanitize.
   * @returns {Array|null} The sanitized array or null if conversion fails.
   */
  static sanitizeIterable(iterableCandidate) {
    // Attempt to convert iterable values
    try {
      // Reject strings because they are iterable collections
      if (typeof iterableCandidate === "string") return null;
      // Return null when value is not iterable
      if (
        iterableCandidate == null ||
        typeof iterableCandidate[Symbol.iterator] !== "function"
      ) {
        return null;
      }
      // Convert iterable to array and filter present values
      return Array.from(iterableCandidate).filter(SafeUtils.hasValue);
    } catch {
      // Warn when conversion fails and debug flag is enabled
      if (SafeUtils.DEBUG)
        console.warn(
          "Conversion failed for sanitizeIterable:",
          iterableCandidate,
        );
      // Return null when conversion fails
      return null;
    }
  }

  /**
   * Create a trimmed escaped string.
   *
   * Coerces any input to string, trims whitespace, and optionally HTML-escapes special characters.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeString #TODO
   *
   * @param {string} [valueCandidate=""] - Value to stringify and trim.
   * @param {boolean} [shouldEscapeEntities=false] - Whether to HTML-escape reserved characters.
   * @returns {string} The sanitized string.
   */
  static sanitizeString(valueCandidate = "", shouldEscapeEntities = false) {
    // Convert non-string values to string
    let normalizedString =
      typeof valueCandidate === "string"
        ? valueCandidate
        : String(valueCandidate);
    // Trim whitespace from the string
    normalizedString = normalizedString.trim();
    // Escape HTML entities when requested
    if (shouldEscapeEntities) {
      // Escape HTML characters safely
      normalizedString = SafeUtils.escapeHtmlEntities(normalizedString);
    }
    // Return the sanitized string result
    return normalizedString;
  }

  /**
   * Detect plain objects safely.
   *
   * Determines whether a value is a plain object in a cross-realm safe way.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#isPlainObject #TODO
   *
   * @param {*} valueCandidate - Value to check.
   * @returns {boolean} True when the value is a plain object.
   */
  static isPlainObject(valueCandidate) {
    // Return true for plain non-array objects
    return (
      valueCandidate !== null &&
      typeof valueCandidate === "object" &&
      !Array.isArray(valueCandidate) &&
      Object.prototype.toString.call(valueCandidate) === "[object Object]"
    );
  }

  /**
   * Escape HTML entities safely.
   *
   * Converts characters to entities while preserving existing named, numeric, and hex entities.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#escapeHtmlEntities #TODO
   *
   * @param {string} stringCandidate - Input string to escape.
   * @returns {string} Escaped string with preserved entities.
   */
  static escapeHtmlEntities(stringCandidate) {
    // Ensure input is string typed
    if (typeof stringCandidate !== "string")
      stringCandidate = String(stringCandidate);
    // Define pattern matching entities or special characters
    const entityOrCharacterRegex =
      /&(?:#\d+|#x[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);|[&<>\"']/g;
    // Replace matches using replacer function
    return stringCandidate.replace(entityOrCharacterRegex, (entityMatch) => {
      // Preserve existing entities that are well-formed
      if (
        entityMatch[0] === "&" &&
        entityMatch.length > 1 &&
        entityMatch[entityMatch.length - 1] === ";"
      ) {
        // Return the original entity when detected
        return entityMatch;
      }
      // Map matched characters to escape sequences
      return {
        // Ampersand replacement
        "&": "&amp;",
        // Less-than replacement
        "<": "&lt;",
        // Greater-than replacement
        ">": "&gt;",
        // Double-quote replacement
        '"': "&quot;",
        // Single-quote replacement
        "'": "&#39;",
      }[entityMatch];
    });
  }

  /**
   * Escape only HTML quotes.
   *
   * Preserves ampersands while converting double and single quotes to entities.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#escapeHtmlQuotes #TODO
   *
   * @param {string} stringCandidate - Input string to escape quotes.
   * @returns {string} String with HTML quotes escaped.
   */
  static escapeHtmlQuotes(stringCandidate) {
    // Ensure input is string typed
    if (typeof stringCandidate !== "string")
      stringCandidate = String(stringCandidate);
    // Define pattern to detect entities and quotes
    const entityOrQuoteRegex =
      /&(?:#\d+|#x[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);|[\"']/g;
    // Replace matches with preserved entities or escaped quotes
    return stringCandidate.replace(entityOrQuoteRegex, (entityOrQuoteMatch) => {
      // Preserve existing HTML entities as-is
      if (
        entityOrQuoteMatch[0] === "&" &&
        entityOrQuoteMatch.length > 1 &&
        entityOrQuoteMatch[entityOrQuoteMatch.length - 1] === ";"
      ) {
        // Return the original entity
        return entityOrQuoteMatch;
      }
      // Convert double and single quotes to entities
      return entityOrQuoteMatch === '"' ? "&quot;" : "&#39;";
    });
  }

  /**
   * Parse safe integers.
   *
   * Accepts finite numbers or base-10 integer strings within the JavaScript safe integer range.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeInteger #TODO
   *
   * @param {*} integerCandidate - Candidate integer value.
   * @returns {number|null} Parsed safe integer or null if invalid.
   */
  static sanitizeInteger(integerCandidate) {
    // Return null when value is null or undefined
    if (integerCandidate === null || integerCandidate === undefined)
      return null;
    // Handle numeric inputs directly
    if (typeof integerCandidate === "number") {
      // Reject non-integer numbers
      if (!Number.isInteger(integerCandidate)) return null;
      // Reject non-finite numbers
      if (!Number.isFinite(integerCandidate)) return null;
      // Reject numbers outside the safe integer range
      if (!Number.isSafeInteger(integerCandidate)) return null;
      // Return the valid integer
      return integerCandidate;
    }
    // Handle string representations
    if (typeof integerCandidate === "string") {
      // Trim whitespace from the string
      const trimmedInput = integerCandidate.trim();
      // Reject inputs that are not signed integers
      if (!/^[+-]?\d+$/.test(trimmedInput)) return null;
      // Parse the trimmed string to a number
      const parsedInteger = Number(trimmedInput);
      // Reject parsed values that are not finite safe integers
      if (
        !Number.isFinite(parsedInteger) ||
        !Number.isSafeInteger(parsedInteger)
      )
        return null;
      // Return the parsed safe integer
      return parsedInteger;
    }
    // Return null for unsupported types
    return null;
  }

  /**
   * Parse safe floats.
   *
   * Accepts finite numbers or strictly validated float strings, including exponent notation, while rejecting malformed values.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeFloat #TODO
   *
   * @param {*} floatCandidate - Candidate floating-point value.
   * @returns {number|null} Finite number or null if invalid.
   */
  static sanitizeFloat(floatCandidate) {
    // Return null when value is null or undefined
    if (floatCandidate == null) return null;
    // Handle numeric values directly
    if (typeof floatCandidate === "number") {
      // Return the number when finite else null
      return Number.isFinite(floatCandidate) ? floatCandidate : null;
    }
    // Handle string inputs
    if (typeof floatCandidate === "string") {
      // Trim whitespace from the string
      const trimmedString = floatCandidate.trim();
      // Return null when string is empty
      if (trimmedString === "") return null;
      // Reject strings that use commas for numeric formatting
      if (/,/.test(trimmedString)) return null;
      // Ensure the string contains digits and only valid characters
      if (!/[0-9]/.test(trimmedString) || /[^0-9+\-eE.]/.test(trimmedString))
        return null;
      // Convert string to number
      const parsedFloat = Number(trimmedString);
      // Return null when parsed value is not finite
      return Number.isFinite(parsedFloat) ? parsedFloat : null;
    }
    // Warn about unsupported types when DEBUG mode is enabled
    if (SafeUtils.DEBUG) {
      // Log unsupported type details
      console.warn("Unsupported type for sanitizeFloat:", floatCandidate);
    }
    // Return null for unsupported types
    return null;
  }

  /**
   * Coerce boolean values safely.
   *
   * Interprets booleans, numeric flags, and common string toggles while returning null for unknown inputs.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeBoolean #TODO
   *
   * @param {*} booleanCandidate - Candidate boolean value.
   * @returns {boolean|null} True/false or null when unrecognized.
   */
  static sanitizeBoolean(booleanCandidate) {
    // Return the value when already a boolean
    if (typeof booleanCandidate === "boolean") {
      // Exit with the boolean value
      return booleanCandidate;
    }
    // Handle numeric inputs
    if (typeof booleanCandidate === "number") {
      // Reject non-finite or NaN numbers
      if (Number.isNaN(booleanCandidate) || !Number.isFinite(booleanCandidate))
        return null;
      // Return boolean for numeric toggles 1/0 or null otherwise
      return booleanCandidate === 1
        ? true
        : booleanCandidate === 0
          ? false
          : null;
    }
    // Handle string inputs
    if (typeof booleanCandidate === "string") {
      // Normalize and trim string for comparisons
      const normalizedInputString = booleanCandidate.trim().toLowerCase();
      // Define truthy string values
      const truthyStringValues = new Set(["true", "1", "yes", "y", "on"]);
      // Define falsy string values
      const falsyStringValues = new Set(["false", "0", "no", "n", "off"]);
      // Return true for normalized truthy strings
      if (truthyStringValues.has(normalizedInputString)) return true;
      // Return false for normalized falsy strings
      if (falsyStringValues.has(normalizedInputString)) return false;
      // Return null when no matching string found
      return null;
    }
    // Return null for unsupported types
    return null;
  }

  /**
   * Sanitize plain objects safely.
   *
   * Clones non-null plain objects while filtering unsafe keys and returning null for empty results.
   *
   * @author Linden May
   * @version 1.0.0
   * @since -
   * @updated -
   * @link https://docs.example.com/SafeUtils#sanitizeObject #TODO
   *
   * @param {*} objectCandidate - Candidate object to validate.
   * @returns {Object|null} Safe shallow-cloned object or null.
   */
  static sanitizeObject(objectCandidate) {
    // Reject values that are not plain objects
    if (!SafeUtils.isPlainObject(objectCandidate)) {
      // Return null for invalid objects
      return null;
    }
    // Create sanitized result container
    const sanitizedObject = {};
    // Collect prototype property names to block
    const prototypePropertyNames = Object.getOwnPropertyNames(
      Object.prototype || {},
    );
    // Combine prototype names with explicit pollution keys
    const explicitBlockedProperties = prototypePropertyNames.concat([
      "__proto__",
      "prototype",
      "constructor",
    ]);
    // Create set of blocked property names
    const blockedPropertyNames = new Set(explicitBlockedProperties);
    // Iterate over each own property of the input object
    for (const [propertyKey, propertyValue] of Object.entries(
      objectCandidate,
    )) {
      // Skip blocked keys entirely
      if (blockedPropertyNames.has(propertyKey)) {
        // Continue to next property when blocked
        continue;
      }
      // Copy safe property to sanitized object
      sanitizedObject[propertyKey] = propertyValue;
    }
    // Return sanitized object when it contains entries, otherwise null
    return Object.keys(sanitizedObject).length > 0 ? sanitizedObject : null;
  }

  /**
   * Normalize and validate email.
   *
   * Trims, lowercases domain, checks length and ASCII pattern; returns null if invalid.
   *
   * @author Linden May
   * @version 1.0.0
   * @since 1.0.0
   * @link #TODO
   *
   * @param {string} emailCandidate - Input email string.
   *
   * @returns {string|null} Normalized email or null if invalid.
   */
  static sanitizeEmail(emailCandidate) {
    // Ensure the input is string typed
    if (typeof emailCandidate !== "string") return null;
    // Trim whitespace from the email input
    const trimmedEmail = emailCandidate.trim();
    // Return null when the trimmed input is empty
    if (trimmedEmail === "") return null;
    // Find the last '@' occurrence in the trimmed string
    const lastAtIndex = trimmedEmail.lastIndexOf("@");
    // Reject addresses with missing or malformed '@'
    if (lastAtIndex < 1 || lastAtIndex === trimmedEmail.length - 1) return null;
    // Extract the domain segment after the last '@'
    const domainSegment = trimmedEmail.slice(lastAtIndex + 1);
    // Locate a previous '@' symbol if present
    const previousAtIndex = trimmedEmail.lastIndexOf("@", lastAtIndex - 1);
    // Compute the actual local part text
    const actualLocalPart =
      previousAtIndex === -1
        ? // Use substring before the last '@' when no earlier '@' exists
          trimmedEmail.slice(0, lastAtIndex)
        : // Use substring between repeated '@' symbols when present
          trimmedEmail.slice(previousAtIndex + 1, lastAtIndex);
    // Reject local or domain parts that exceed maximum lengths
    if (actualLocalPart.length > 64 || domainSegment.length > 255) return null;
    // Reject domains that end with a dot
    if (domainSegment.endsWith(".")) return null;
    // Reject invalid domain labels by length
    if (
      // Check individual domain label lengths
      domainSegment
        .split(".")
        .some((label) => label.length < 1 || label.length > 63)
    )
      return null;
    // Enforce ASCII-only characters in local and domain parts
    const asciiOnlyPattern = /^[\x00-\x7F]+$/;
    if (
      // Validate local part characters
      !asciiOnlyPattern.test(actualLocalPart) ||
      // Validate domain characters
      !asciiOnlyPattern.test(domainSegment)
    )
      return null;
    // Build normalized email candidate by lowercasing both parts
    const normalizedEmailCandidate = `${actualLocalPart.toLowerCase()}@${domainSegment.toLowerCase()}`;
    // Validate the normalized candidate against a standard regex
    const standardEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!standardEmailPattern.test(normalizedEmailCandidate)) return null;
    // Return the normalized valid email string
    return normalizedEmailCandidate;
  }

  /**
   * Merge entries into defaults safely.
   *
   * Parses various input shapes into key/value pairs and merges into a cloned defaults object.
   *
   * @author Linden May
   * @version 1.0.0
   * @since 1.0.0
   * @link #TODO
   *
   * @param {(URLSearchParams|string|Array|Object|null|undefined)} argumentSource - Source of entries.
   * @param {Object} [defaultValues={}] - Default key/value pairs.
   *
   * @returns {Object} Resulting merged arguments object.
   */
  static parseArgs(argumentSource, defaultValues = {}) {
    // Validate that defaults is a plain object
    if (
      !defaultValues ||
      typeof defaultValues !== "object" ||
      Array.isArray(defaultValues)
    ) {
      // Throw when defaults are invalid
      throw new TypeError("parseArgs(): defaults must be a plain object");
    }
    // Clone defaults into the merged result
    const mergedResult = Object.assign({}, defaultValues);
    // Define helper for assigning sanitized entries
    const assignSanitizedEntry = (paramKey, paramValue) => {
      // Skip prototype pollution related keys
      if (
        paramKey === "__proto__" ||
        paramKey === "constructor" ||
        paramKey === "prototype"
      ) {
        // Exit helper when keys are unsafe
        return;
      }
      // Preserve primitive values directly
      if (
        typeof paramValue === "number" ||
        typeof paramValue === "boolean" ||
        paramValue === null
      ) {
        // Assign primitives without further processing
        mergedResult[paramKey] = paramValue;
        // Exit helper after assignment
        return;
      }
      // Convert non-primitives to string
      const stringCandidate = String(paramValue);
      // Sanitize the string candidate
      let sanitizedEntry = SafeUtils.sanitizeTextField(stringCandidate);
      // Trim whitespace from the sanitized entry
      sanitizedEntry = sanitizedEntry.trim();
      // Assign the sanitized entry to output
      mergedResult[paramKey] = sanitizedEntry;
    };
    // Return defaults when argumentSource is null or undefined
    if (argumentSource == null) return mergedResult;
    // Handle string argument forms
    if (typeof argumentSource === "string") {
      // Strip leading question mark from query strings
      const queryString = argumentSource.startsWith("?")
        ? argumentSource.slice(1)
        : argumentSource;
      // Parse string into URLSearchParams
      const urlSearchParams = new URLSearchParams(queryString);
      // Assign each parsed parameter
      for (const [paramKey, paramValue] of urlSearchParams.entries())
        assignSanitizedEntry(paramKey, paramValue);
      // Return merged output for string argument
      return mergedResult;
    }
    // Handle URLSearchParams argument inputs directly
    if (argumentSource instanceof URLSearchParams) {
      // Assign each entry from URLSearchParams
      for (const [paramKey, paramValue] of argumentSource.entries())
        assignSanitizedEntry(paramKey, paramValue);
      // Return merged output for URLSearchParams argument
      return mergedResult;
    }
    // Handle array-of-pairs arguments
    if (Array.isArray(argumentSource)) {
      // Iterate through array entries
      for (const pair of argumentSource) {
        // Only process pairs that contain exactly two elements
        if (Array.isArray(pair) && pair.length === 2) {
          // Destructure the pair into key and value
          const [arrayPairKey, arrayPairValue] = pair;
          // Only handle string keys
          if (typeof arrayPairKey === "string") {
            // Coerce the value to string when needed
            const coercedPairValue =
              typeof arrayPairValue === "string"
                ? arrayPairValue
                : String(arrayPairValue);
            // Assign the sanitized entry for the coerced value
            assignSanitizedEntry(arrayPairKey, coercedPairValue);
          }
        }
      }
      // Return merged output for array arguments
      return mergedResult;
    }
    // Handle plain object arguments
    if (typeof argumentSource === "object") {
      // Iterate over object entries
      for (const [objectKey, objectValue] of Object.entries(argumentSource)) {
        // Assign entries only when keys are strings
        if (typeof objectKey === "string")
          assignSanitizedEntry(objectKey, objectValue);
      }
      // Return merged output for object arguments
      return mergedResult;
    }
    // Return defaults when argument type is unsupported
    return mergedResult;
  }

  /**
   * Parse a URL into parts.
   *
   * Light URL parser supporting absolute/relative inputs; optionally returns one component.
   *
   * @author Linden May
   * @version 1.0.0
   * @since 1.0.0
   * @link #TODO
   *
   * @param {string} urlString - URL string to parse.
   * @param {string|null} [requestedComponent=null] - Specific component key to return.
   *
   * @returns {(false|Object|string|null)} False if invalid; parts object or selected component.
   */
  static parseUrl(urlString, requestedComponent = null) {
    // Ensure the URL string is a non-empty string
    if (typeof urlString !== "string" || urlString.length === 0) return false;
    // Reject values that exceed the length limit
    if (urlString.length > 4096) return false;
    // Reject URL strings containing control characters
    if (/[\u0000-\u001F\u007F]/.test(urlString)) return false;
    // Attempt to parse the URL string with the URL API
    try {
      // Create URL instance with a base to support relative inputs
      const parsedUrlInstance = new URL(urlString, "http://_base_/");
      // Determine whether the URL string appears to be absolute
      const isAbsoluteUrl = /^[A-Za-z][A-Za-z0-9+.\-]*:/.test(urlString);
      // Build structured components from the parsed URL
      const parsedComponents = {
        // Set the scheme or empty string for relative inputs
        scheme: isAbsoluteUrl
          ? parsedUrlInstance.protocol.replace(/:$/, "") || ""
          : "",
        // Set the host or empty string for relative inputs
        host: isAbsoluteUrl ? parsedUrlInstance.hostname || "" : "",
        // Set the port as number or null when absent
        port:
          // Include port only for absolute URLs with port data
          isAbsoluteUrl && parsedUrlInstance.port
            ? // Convert the parsed port to a number
              Number(parsedUrlInstance.port)
            : // Default to null when no port is present
              null,
        // Set the path or empty string
        path: parsedUrlInstance.pathname || "",
        // Set the query without leading question mark
        query:
          // Use search string when available
          parsedUrlInstance.search
            ? // Strip leading question mark from search
              parsedUrlInstance.search.replace(/^\?/, "")
            : // Default to empty string when no search fragment
              "",
        // Set the fragment without leading hash
        fragment:
          // Use hash when available
          parsedUrlInstance.hash
            ? // Strip leading hash from fragment
              parsedUrlInstance.hash.replace(/^#/, "")
            : // Default to empty string when no fragment is present
              "",
      };
      // Return the full components when no specific component requested
      if (requestedComponent == null) return parsedComponents;
      // Reject host/scheme/port requests for relative inputs
      if (
        !isAbsoluteUrl &&
        ["host", "scheme", "port"].includes(requestedComponent)
      ) {
        return false;
      }
      // Preserve original path for relative URL strings without leading slash
      if (
        requestedComponent === "path" &&
        !isAbsoluteUrl &&
        !urlString.startsWith("/")
      ) {
        return urlString;
      }
      // Return requested component or false when missing
      return Object.prototype.hasOwnProperty.call(
        parsedComponents,
        requestedComponent,
      )
        ? parsedComponents[requestedComponent]
        : false;
      // Catch parsing errors uniformly
    } catch {
      // Return false when parsing fails
      return false;
    }
  }

  /**
   * Add or update query arguments.
   *
   * Accepts single key/value or an object of params, preserving fragments and existing params.
   *
   * @author Linden May
   * @version 1.0.0
   * @since 1.0.0
   * @link #TODO
   *
   * @param {(Object|string|number|null|undefined)} parameterKeyOrMap - Key name or params object.
   * @param {*} valueOrUrlCandidate - Value for key, or URL when parameterKeyOrMap is a params object.
   * @param {(string|number|undefined)} targetUrlCandidate - URL when parameterKeyOrMap is a single key.
   *
   * @returns {string} URL with updated query string.
   */
  static addQueryArg(
    parameterKeyOrMap,
    valueOrUrlCandidate,
    targetUrlCandidate,
  ) {
    // Define helper function to apply query parameters
    const applyQueryParamsToUrl = (baseUrlString, parameterMap) => {
      // Declare URL object variable
      let urlObject;
      // Attempt to construct the URL
      try {
        // Create URL instance from string
        urlObject = new URL(baseUrlString);
        // Catch malformed URL errors
      } catch {
        // Return original string when parsing fails
        return baseUrlString;
      }
      // Access the URLSearchParams from the URL
      const searchParams = urlObject.searchParams;
      // Iterate over the entries in the params object
      for (const [parameterKey, parameterValue] of Object.entries(
        parameterMap,
      )) {
        // Skip parameter names that are not string or number
        if (
          typeof parameterKey !== "string" &&
          typeof parameterKey !== "number"
        )
          continue;
        // Remove parameter when value is null or undefined
        if (parameterValue === null || parameterValue === undefined) {
          // Delete the parameter from the URLSearchParams
          searchParams.delete(String(parameterKey));
        } else {
          // Attempt to set the parameter using string values
          try {
            // Set the sanitized parameter key and value
            searchParams.set(String(parameterKey), String(parameterValue));
            // Catch errors when values are not stringifiable
          } catch {
            // Skip assignments that cannot be stringified
          }
        }
      }
      // Update the search string on the URL object
      urlObject.search = searchParams.toString();
      // Return the modified URL string
      return urlObject.toString();
    };
    // Detect when first argument is a params object
    if (
      typeof parameterKeyOrMap === "object" &&
      parameterKeyOrMap !== null &&
      !Array.isArray(parameterKeyOrMap)
    ) {
      // Apply multiple parameters to the provided URL
      return applyQueryParamsToUrl(
        String(valueOrUrlCandidate || ""),
        parameterKeyOrMap,
      );
    }
    // Store the key name for the single parameter
    const parameterKey = parameterKeyOrMap;
    // Store the value for the single parameter
    const parameterValue = valueOrUrlCandidate;
    // Convert the target URL candidate into a string
    const targetUrlString = String(targetUrlCandidate || "");
    // Reject invalid parameter keys
    if (typeof parameterKey !== "string" && typeof parameterKey !== "number") {
      // Return original target URL when key invalid
      return targetUrlString;
    }
    // Apply the single parameter and return the updated URL
    return applyQueryParamsToUrl(targetUrlString, {
      [String(parameterKey)]: parameterValue,
    });
  }

  /**
   * Infer array element type.
   *
   * Returns a simple type annotation like "number[]" or "mixed[]" for the array contents.
   * Note: For object elements this function returns "object[]" and does not
   * deeply validate object shapes or field consistency. It is intentionally
   * shallow for performance; implement a schema-aware helper if deep analysis
   * is required.
   *
   * @author Linden May
   * @version 1.0.0
   * @since 1.0.0
   * @link #TODO
   *
   * @param {Array} arrayCandidate - Array to analyze.
   *
   * @returns {string} Element type annotation for the array.
   */
  static getArrayType(arrayCandidate) {
    // Throw when the argument is not an array
    if (!Array.isArray(arrayCandidate)) {
      // Throw a TypeError for invalid input
      throw new TypeError("getArrayType(): expected an array input");
    }
    // Return mixed[] for empty arrays
    if (arrayCandidate.length === 0) return "mixed[]";
    // Map each element to its inferred type signature
    const elementTypeSignatures = arrayCandidate.map((elementValue) => {
      // Handle nested arrays via recursion
      if (Array.isArray(elementValue)) {
        // Return nested array type annotation
        return SafeUtils.getArrayType(elementValue);
      }
      // Return the primitive typeof result
      return typeof elementValue;
    });
    // Create a set of unique type signatures
    const uniqueElementTypes = [...new Set(elementTypeSignatures)];
    // Return single-type annotation when only one unique type exists
    if (uniqueElementTypes.length === 1) {
      // Append [] suffix to the unique type
      return uniqueElementTypes[0] + "[]";
    }
    // Return mixed[] when multiple types are present
    return "mixed[]";
  }

  /**
   * Format error message.
   *
   * Creates and returns a new TypeError with the given method name and message.
   *
   * @author Linden May
   * @version 1.0.0
   * @since 1.0.0
   * @link #TODO
   *
   * @param {string} methodName - The method name associated with the error.
   * @param {string} errorMessage - The error message to include.
   *
   * @returns {TypeError} A new TypeError instance with formatted message.
   */
  static formatError(methodName, errorMessage) {
    // Convert the method identifier to string
    const methodNameString = String(methodName);
    // Convert the message to string
    const formattedMessage = String(errorMessage);
    // Return a TypeError that includes the formatted message
    return new TypeError(`${methodNameString}(): ${formattedMessage}`);
  }

  /**
   * Sanitize HTML with a whitelist.
   *
   * Removes disallowed tags/attributes, comments, and optionally escapes text node characters.
   *
   * @author Linden May
   * @version 1.0.0
   * @since 1.0.0
   * @link #TODO
   *
   * @param {string} htmlInput - Raw HTML input to sanitize.
   * @param {boolean} [shouldEscapeTextNodes=false] - Whether to escape special characters in text nodes.
   *
   * @returns {string} Sanitized HTML string.
   */
  static sanitizeHtmlWithWhitelist(htmlInput, shouldEscapeTextNodes = false) {
    // Return empty string when input is not a string
    if (typeof htmlInput !== "string") return "";
    // Return empty string for empty inputs
    if (htmlInput === "") return "";
    // Allow injecting a JSDOM implementation for tests
    let JSDOM = SafeUtils._JSDOM || null;
    // Load the JSDOM implementation when not provided
    if (!JSDOM) {
      // Attempt to require jsdom dynamically
      try {
        // Extract JSDOM constructor from jsdom dependency
        ({ JSDOM } = require("jsdom"));
        // Handle cases where jsdom is unavailable
      } catch {
        // Fallback by stripping tags manually
        let result = htmlInput.replace(/<[^>]*>/g, "").trim();
        // Optionally escape characters when requested
        if (shouldEscapeTextNodes) {
          // Escape ampersands
          result = result
            .replace(/&/g, "&amp;")
            // Escape less-than signs
            .replace(/</g, "&lt;")
            // Escape greater-than signs
            .replace(/>/g, "&gt;")
            // Escape double quotes
            .replace(/"/g, "&quot;")
            // Escape single quotes
            .replace(/'/g, "&#39;");
        }
        // Return the fallback text result
        return result;
      }
    }
    // Create a DOM instance wrapping the input inside a body
    const domInstance = new JSDOM(`<body>${htmlInput}</body>`);
    // Extract the document object from the DOM
    const { document } = domInstance.window;
    // Define whitelist of allowed tags and their permitted attributes
    const allowedTagAttributes = {
      A: ["href", "title", "target", "rel"],
      ABBR: ["title"],
      B: [],
      BLOCKQUOTE: ["cite"],
      BR: [],
      CITE: [],
      CODE: [],
      DEL: ["datetime"],
      EM: [],
      I: [],
      INS: ["datetime"],
      LI: [],
      OL: [],
      P: [],
      Q: ["cite"],
      SPAN: [],
      STRONG: [],
      UL: [],
    };
    // Check whether a DOM element tag is allowed by the whitelist
    const isTagAllowed = (element) => {
      // Return true when the tag exists in the whitelist
      return Object.prototype.hasOwnProperty.call(
        allowedTagAttributes,
        element.tagName,
      );
    };
    // Recursively sanitize a DOM node tree
    function sanitizeNode(node) {
      // Iterate over child nodes in reverse so mutations are safe
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        // Capture the current child node reference
        const child = node.childNodes[i];
        // Handle element nodes by tag name and attributes
        if (child.nodeType === 1) {
          // Normalize tag name to uppercase
          const tagName = child.tagName.toUpperCase();
          // Replace disallowed elements with their text content
          if (!isTagAllowed(child)) {
            // Create a text node containing the child's text
            const replacementTextNode = document.createTextNode(
              child.textContent || "",
            );
            // Replace the disallowed element with the text node
            node.replaceChild(replacementTextNode, child);
            // Continue processing the next child node
            continue;
          }
          // Build a set of attributes the tag is allowed to keep
          const allowedAttributeSet = new Set(allowedTagAttributes[tagName]);
          // Iterate over the element's attributes to prune them
          for (const attr of Array.from(child.attributes)) {
            // Remove attributes that are not in the whitelist
            if (!allowedAttributeSet.has(attr.name)) {
              // Remove the forbidden attribute
              child.removeAttribute(attr.name);
            }
          }
          // Apply anchor-specific sanitation rules
          if (tagName === "A") {
            // Read the raw href attribute value
            const rawHrefValue = child.getAttribute("href");
            // Sanitize the href using a protocol allowlist
            let sanitizedHref = SafeUtils.escUrl(rawHrefValue, [
              "http:",
              "https:",
            ]);
            // Remove trailing slash from sanitized URLs
            if (sanitizedHref && sanitizedHref.endsWith("/")) {
              sanitizedHref = sanitizedHref.slice(0, -1);
            }
            // Replace the anchor with plain text when href is invalid
            if (!sanitizedHref) {
              // Create a text node from the anchor text
              const anchorReplacementText = document.createTextNode(
                child.textContent || "",
              );
              // Replace the anchor node with the text node
              node.replaceChild(anchorReplacementText, child);
              // Continue to the next sibling without recursing
              continue;
            }
            // Write the sanitized href back onto the anchor element
            child.setAttribute("href", sanitizedHref);
            // Enforce rel attributes when target is _blank
            if (child.getAttribute("target") === "_blank") {
              // Prevent tabnabbing by setting rel
              child.setAttribute("rel", "noopener noreferrer");
            }
          }
          // Recurse into the allowed child element's subtree
          sanitizeNode(child);
          // Continue to the next child node after recursion
          continue;
        }
        // Remove comment nodes outright
        if (child.nodeType === 8) {
          // Remove the comment node from the tree
          node.removeChild(child);
          // Continue with the next child node
          continue;
        }
        // Process text nodes when shouldEscapeTextNodes is requested
        if (child.nodeType === 3 && shouldEscapeTextNodes) {
          // Capture the current text node value
          const textNodeValue = child.nodeValue || "";
          // Escape only quotes in the text node value
          const escapedTextNodeValue =
            SafeUtils.escapeHtmlQuotes(textNodeValue);
          // Update the node when escaping changed the string
          if (escapedTextNodeValue !== textNodeValue) {
            // Assign the escaped value to the text node
            child.nodeValue = escapedTextNodeValue;
          }
        }
      }
    }
    // Sanitize the document body content recursively
    sanitizeNode(document.body);
    // Capture the innerHTML result from the sanitized DOM
    let result = document.body.innerHTML;
    // Fix double-encoded quotes that the DOM may have produced
    if (shouldEscapeTextNodes) {
      // Replace double-encoded double quotes
      result = result
        // Fix &amp;quot; sequences
        .replace(/&amp;quot;/g, "&quot;")
        // Fix &amp;#39; sequences
        .replace(/&amp;#39;/g, "&#39;");
    }
    // Return the sanitized HTML string
    return result;
  }
}

module.exports = SafeUtils;
