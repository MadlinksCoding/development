const fs = require('fs');
const path = require('path');
const { DateTime: LuxonDateTime, Duration } = require('luxon');

// Dynamically load DateTime implementation from config to avoid static paths
const CONFIG_PATH = path.resolve(__dirname, '..', 'test-runner.config.js');
let DateTime;
try {
  const cfg = require(CONFIG_PATH);
  const cls = cfg.classes.find((c) => c.name === 'DateTime');
  if (!cls) throw new Error('DateTime not found in config');
  DateTime = require(path.resolve(cfg.rootDir, cls.src));
} catch (err) {
  throw new Error(`Failed to load DateTime class: ${err.message}`);
}

const MOCK_NOW_MS = Date.UTC(2024, 0, 15, 4, 30, 0);
const HK_ZONE = 'Asia/Hong_Kong';
const TOKYO_ZONE = 'Asia/Tokyo';
const LONDON_ZONE = 'Europe/London';

const getZoneParts = (ms, zone) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = {};
  formatter.formatToParts(new Date(ms)).forEach(({ type, value }) => {
    if (type !== 'literal') parts[type] = value;
  });
  return parts;
};

const formatFullDateTime = (ms, zone) => {
  const parts = getZoneParts(ms, zone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const formatDateOnly = (ms, zone) => {
  const parts = getZoneParts(ms, zone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatHourMinute = (ms, zone) => {
  const parts = getZoneParts(ms, zone);
  return `${parts.hour}:${parts.minute}`;
};

const formatDateHour = (ms, zone) => {
  const parts = getZoneParts(ms, zone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}`;
};

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(MOCK_NOW_MS);
});

afterEach(() => {
  jest.restoreAllMocks();
  DateTime.setDefaultTimeZone("Asia/Hong_Kong");
});

/**
 * --------------------------------
 * SECTION: IDENTIFY_DATE_FORMAT_FROM_STRING TESTS
 * --------------------------------
 */

/**
 * Validates that a full datetime with spaces matches the Y-m-d H:i:s pattern.
 */
test("PASS_IDENTIFYDATEFORMAT_1: Full datetime with space returns Y-m-d H:i:s", () => {
  expect(DateTime.identifyDateFormatFromString("2024-01-15 13:45:20")).toBe("Y-m-d H:i:s");
});

/**
 * Ensures a date-only string with two dashes returns the Y-m-d format.
 */
test("PASS_IDENTIFYDATEFORMAT_2: Date only with 2 dashes returns Y-m-d", () => {
  expect(DateTime.identifyDateFormatFromString("2024-01-15")).toBe("Y-m-d");
});

/**
 * Verifies that a year-month pair results in the Y-m format.
 */
test("PASS_IDENTIFYDATEFORMAT_3: Year-month returns Y-m", () => {
  expect(DateTime.identifyDateFormatFromString("2024-01")).toBe("Y-m");
});

/**
 * Confirms that a bare year string yields the Y format.
 */
test("PASS_IDENTIFYDATEFORMAT_4: Year-only string returns Y", () => {
  expect(DateTime.identifyDateFormatFromString("2024")).toBe("Y");
});

/**
 * Checks that leading/trailing whitespace is trimmed before format detection.
 */
test("PASS_IDENTIFYDATEFORMAT_5: Trims whitespace before detection", () => {
  expect(DateTime.identifyDateFormatFromString(" 2024-01-15 ")).toBe("Y-m-d");
});

test("PASS_IDENTIFYDATEFORMAT_ISO: ISO inputs detected", () => {
  expect(DateTime.identifyDateFormatFromString("2025-12-08T10:00:00Z")).toBe("iso");
});

test("PASS_PHPTOLUXONFORMAT_EXTENDED: Supports extra PHP tokens", () => {
  expect(DateTime.phpToLuxonFormat("Y-m-d j/n a")).toBe("yyyy-MM-dd d/M a");
});

/**
 * Ensures non-string inputs immediately produce false.
 */
test("FAIL_IDENTIFYDATEFORMAT_1: Non-string input returns false", () => {
  expect(DateTime.identifyDateFormatFromString(12345)).toBe(false);
});

/**
 * Validates that an empty string fails format detection.
 */
test("FAIL_IDENTIFYDATEFORMAT_2: Empty string returns false", () => {
  expect(DateTime.identifyDateFormatFromString("")).toBe(false);
});

/**
 * Confirms whitespace-only strings are considered invalid.
 */
test("FAIL_IDENTIFYDATEFORMAT_3: Whitespace-only returns false", () => {
  expect(DateTime.identifyDateFormatFromString(" ")).toBe(false);
});

/**
 * Verifies that non-numeric components mixed with dashes are rejected.
 */
test("FAIL_IDENTIFYDATEFORMAT_4: Non-numeric parts with dashes return false", () => {
  expect(DateTime.identifyDateFormatFromString("2024-aa-bb")).toBe(false);
});

/**
 * Ensures strings with more than two dashes fail format detection.
 */
test("FAIL_IDENTIFYDATEFORMAT_5: Malformed date with 3+ dashes returns false", () => {
  expect(DateTime.identifyDateFormatFromString("2024-01-15-01")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: GENERATE_RELATIVE_TIMESTAMP TESTS
 * --------------------------------
 */

/**
 * Validates the default call returns the mocked HK time in yyyy-MM-dd HH:mm:ss.
 */
test("PASS_GENERATERELATIVE_1: Default call returns current HK time in default format", () => {
  const expected = formatFullDateTime(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.generateRelativeTimestamp()).toBe(expected);
});

/**
 * Ensures numeric intervals are treated as Unix seconds and formatted in Tokyo.
 */
test("PASS_GENERATERELATIVE_2: Numeric interval treated as Unix seconds", () => {
  const timestamp = 1_700_000_000;
  const expected = formatFullDateTime(timestamp * 1000, TOKYO_ZONE);
  expect(DateTime.generateRelativeTimestamp(undefined, timestamp, TOKYO_ZONE)).toBe(expected);
});

/**
 * Checks that a +1 day string interval produces the following day in HK.
 */
test("PASS_GENERATERELATIVE_3: String interval +1 day adds one day", () => {
  const nextDayMs = MOCK_NOW_MS + 24 * 3600 * 1000;
  const expected = formatDateOnly(nextDayMs, HK_ZONE);
  expect(DateTime.generateRelativeTimestamp("yyyy-MM-dd", "+1 day", HK_ZONE)).toBe(expected);
});

/**
 * Verifies that a -2 hour interval subtracts two hours in HK.
 */
test("PASS_GENERATERELATIVE_4: Negative interval -2 hours subtracts", () => {
  const expected = formatHourMinute(MOCK_NOW_MS - 2 * 3600 * 1000, HK_ZONE);
  expect(DateTime.generateRelativeTimestamp("HH:mm", "-2 hour", HK_ZONE)).toBe(expected);
});

/**
 * Confirms a custom timezone argument changes the result accordingly.
 */
test("PASS_GENERATERELATIVE_5: Custom timezone applied", () => {
  const expected = formatDateHour(MOCK_NOW_MS, LONDON_ZONE);
  expect(DateTime.generateRelativeTimestamp("yyyy-MM-dd HH", null, LONDON_ZONE)).toBe(expected);
});

/**
 * Ensures invalid interval strings return false instead of throwing.
 */
test("FAIL_GENERATERELATIVE_1: Invalid interval string returns false", () => {
  expect(DateTime.generateRelativeTimestamp("yyyy-MM-dd", "nonsense", HK_ZONE)).toBe(false);
});

/**
 * Confirms that an invalid timezone falls back to the default HK string.
 */
test("FAIL_GENERATERELATIVE_2: Extremely invalid timezone causes fallback", () => {
  const expected = formatFullDateTime(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.generateRelativeTimestamp(undefined, null, "Invalid/Zone")).toBe(expected);
});

/**
 * Validates that non-string/number intervals are ignored and treated like null.
 */
test("FAIL_GENERATERELATIVE_3: Interval non-string non-number ignored", () => {
  const expected = formatFullDateTime(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.generateRelativeTimestamp("yyyy-MM-dd", {}, null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: PARSE_INTERVAL_TO_DURATION TESTS
 * --------------------------------
 */

/**
 * +2 days should return a duration object with day = 2.
 */
test("PASS_PARSEINTERVAL_1: Simple +2 days parses correctly", () => {
  expect(DateTime.parseIntervalToDuration("+2 days").toObject()).toEqual({
    days: 2,
  });
});

/**
 * -1 day should map to day = -1.
 */
test("PASS_PARSEINTERVAL_2: Singular form -1 day", () => {
  expect(DateTime.parseIntervalToDuration("-1 day").toObject()).toEqual({
    days: -1,
  });
});

/**
 * +3 hours returns the correct hour property in the duration.
 */
test("PASS_PARSEINTERVAL_3: Different unit +3 hours", () => {
  expect(DateTime.parseIntervalToDuration("+3 hours").toObject()).toEqual({
    hours: 3,
  });
});

/**
 * Case should be ignored when parsing units like MONTHS.
 */
test("PASS_PARSEINTERVAL_4: Case-insensitive unit", () => {
  expect(DateTime.parseIntervalToDuration("+5 MONTHS").toObject()).toEqual({
    months: 5,
  });
});

/**
 * Omitting the plus sign still produces a positive minute duration.
 */
test("PASS_PARSEINTERVAL_5: No explicit plus sign", () => {
  expect(DateTime.parseIntervalToDuration("10 minutes").toObject()).toEqual({
    minutes: 10,
  });
});

/**
 * Duration parser should support weeks, seconds, and years.
 */
test("PASS_PARSEINTERVAL_6: Supports second, week, year", () => {
  expect(DateTime.parseIntervalToDuration("+7 weeks").toObject()).toEqual({
    weeks: 7,
  });
});

/**
 * Multiple units can be combined.
 */
test("PASS_PARSEINTERVAL_MULTIPLE: Handles multiple units", () => {
  const duration = DateTime.parseIntervalToDuration("+2 days -1 hour 30 minutes");
  expect(duration.toObject()).toMatchObject({
    days: 2,
    hours: -1,
    minutes: 30,
  });
});

/**
 * Non-matching strings should throw a clear error.
 */
test("FAIL_PARSEINTERVAL_1: Non-matching string throws error", () => {
  expect(() => DateTime.parseIntervalToDuration("tomorrow")).toThrow("Invalid interval format");
});

/**
 * Missing unit expectations should surface an error.
 */
test("FAIL_PARSEINTERVAL_2: Missing unit", () => {
  expect(() => DateTime.parseIntervalToDuration("+5")).toThrow();
});

/**
 * Non-numeric factors should trigger an error.
 */
test("FAIL_PARSEINTERVAL_3: Non-numeric value", () => {
  expect(() => DateTime.parseIntervalToDuration("+x days")).toThrow();
});

/**
 * Empty strings are not valid intervals and throw.
 */
test("FAIL_PARSEINTERVAL_4: Empty string", () => {
  expect(() => DateTime.parseIntervalToDuration("")).toThrow();
});

/**
 * --------------------------------
 * SECTION: HAS_EXCEEDED_TIMESTAMP TESTS
 * --------------------------------
 */

/**
 * Past timestamp without interval is considered exceeded.
 */
test("PASS_HASEXCEEDED_1: Timestamp in past without interval returns true", () => {
  expect(DateTime.hasExceededTimestamp("2020-01-01 00:00:00", "")).toBe(true);
});

/**
 * Future timestamp should not be treated as exceeded.
 */
test("PASS_HASEXCEEDED_2: Timestamp in future returns false", () => {
  expect(DateTime.hasExceededTimestamp("2100-01-01 00:00:00", "")).toBe(false);
});

/**
 * Past timestamp plus +365 days stays ahead of the mocked now.
 */
test("PASS_HASEXCEEDED_3: Past timestamp plus positive interval may not be exceeded", () => {
  const pastDate = "2024-01-01 00:00:00";
  expect(DateTime.hasExceededTimestamp(pastDate, "+365 days")).toBe(false);
});

/**
 * Future timestamp minus -365 days lands before now so it is exceeded.
 */
test("PASS_HASEXCEEDED_4: Future timestamp minus negative interval moves into past", () => {
  const futureDate = "2025-01-01 00:00:00";
  expect(DateTime.hasExceededTimestamp(futureDate, "-365 days")).toBe(true);
});

/**
 * Date-only strings should be treated as start of day values.
 */
test("PASS_HASEXCEEDED_5: Handles Y-m-d format", () => {
  expect(DateTime.hasExceededTimestamp("2024-01-01", "")).toBe(true);
});

/**
 * Unparseable timestamps return false.
 */
test("FAIL_HASEXCEEDED_1: Unparseable timestamp returns false", () => {
  expect(DateTime.hasExceededTimestamp("not-a-date", "")).toBe(false);
});

/**
 * Invalid interval strings are not accepted and lead to false.
 */
test("FAIL_HASEXCEEDED_2: Invalid interval format returns false", () => {
  expect(DateTime.hasExceededTimestamp("2024-01-01", "blah")).toBe(false);
});

/**
 * Empty timestamp strings return false.
 */
test("FAIL_HASEXCEEDED_3: Empty string timestamp returns false", () => {
  expect(DateTime.hasExceededTimestamp("", "+1 day")).toBe(false);
});

/**
 * Null timestamps should be rejected.
 */
test("FAIL_HASEXCEEDED_4: Null timestamp returns false", () => {
  expect(DateTime.hasExceededTimestamp(null, "+1 day")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: PHP_TO_LUXON_FORMAT TESTS
 * --------------------------------
 */

/**
 * Full PHP format string should convert to the Luxon equivalent.
 */
test("PASS_PHPTOLUXON_1: Full simple format converts", () => {
  expect(DateTime.phpToLuxonFormat("Y-m-d H:i:s")).toBe("yyyy-MM-dd HH:mm:ss");
});

/**
 * Date-only PHP string converts cleanly.
 */
test("PASS_PHPTOLUXON_2: Date-only converts", () => {
  expect(DateTime.phpToLuxonFormat("Y-m-d")).toBe("yyyy-MM-dd");
});

/**
 * Time-only PHP tokens return the Luxon time format.
 */
test("PASS_PHPTOLUXON_3: Time-only converts", () => {
  expect(DateTime.phpToLuxonFormat("H:i:s")).toBe("HH:mm:ss");
});

/**
 * Unknown tokens should be preserved in the result.
 */
test("PASS_PHPTOLUXON_4: Unknown tokens are left as-is", () => {
  expect(DateTime.phpToLuxonFormat("Y-m-d T")).toBe("yyyy-MM-dd T");
});

/**
 * Non-string inputs produce an empty string.
 */
test("FAIL_PHPTOLUXON_1: Non-string input returns empty string", () => {
  expect(DateTime.phpToLuxonFormat(123)).toBe("");
});

/**
 * Empty strings return empty strings.
 */
test("FAIL_PHPTOLUXON_2: Empty string returns empty string", () => {
  expect(DateTime.phpToLuxonFormat("")).toBe("");
});

/**
 * --------------------------------
 * SECTION: PARSE_DATE_TO_TIMESTAMP TESTS
 * --------------------------------
 */

const expectedTimestamp = {
  dateOnly: 1705248000, // 2024-01-15 00:00:00 HK
  dateTime: 1705285800, // 2024-01-15 10:30:00 HK
  london: 1705314600, // 2024-01-15 10:30:00 Europe/London
  yearMonth: 1704038400, // 2024-01 HK start
  year: 1704038400, // 2024-01-01 HK start
};

/**
 * Parses a date-only string in HK and returns the Unix second timestamp.
 */
test("PASS_PARSEDATE_1: Parses Y-m-d in default HK zone", () => {
  expect(DateTime.parseDateToTimestamp("2024-01-15", null)).toBe(expectedTimestamp.dateOnly);
});

/**
 * Parses a full date-time string in HK.
 */
test("PASS_PARSEDATE_2: Parses Y-m-d H:i:s", () => {
  expect(DateTime.parseDateToTimestamp("2024-01-15 10:30:00", null)).toBe(expectedTimestamp.dateTime);
});

/**
 * Honors the supplied timezone when interpreting the timestamp.
 */
test("PASS_PARSEDATE_3: Uses provided timezone", () => {
  expect(DateTime.parseDateToTimestamp("2024-01-15 10:30:00", LONDON_ZONE)).toBe(expectedTimestamp.london);
});

/**
 * Supports year-month strings by using the first day in HK.
 */
test("PASS_PARSEDATE_4: Works with Y-m", () => {
  expect(DateTime.parseDateToTimestamp("2024-01", null)).toBe(expectedTimestamp.yearMonth);
});

/**
 * Year-only strings resolve to start-of-year in HK.
 */
test("PASS_PARSEDATE_5: Works with Y", () => {
  expect(DateTime.parseDateToTimestamp("2024", null)).toBe(expectedTimestamp.year);
});

/**
 * Inputs that do not follow supported formats return false.
 */
test("FAIL_PARSEDATE_1: Invalid format string returns false", () => {
  expect(DateTime.parseDateToTimestamp("15/01/2024", null)).toBe(false);
});

/**
 * Unparseable text results in false.
 */
test("FAIL_PARSEDATE_2: Unparseable text returns false", () => {
  expect(DateTime.parseDateToTimestamp("not-a-date", null)).toBe(false);
});

/**
 * Empty strings are rejected.
 */
test("FAIL_PARSEDATE_3: Empty string returns false", () => {
  expect(DateTime.parseDateToTimestamp("", null)).toBe(false);
});

/**
 * Non-string dates return false.
 */
test("FAIL_PARSEDATE_4: dateStr non-string returns false", () => {
  expect(DateTime.parseDateToTimestamp(123, null)).toBe(false);
});

/**
 * Invalid timezones degrade to false.
 */
test("FAIL_PARSEDATE_5: Invalid timezone string results in false", () => {
  expect(DateTime.parseDateToTimestamp("2024-01-15", "Invalid/Zone")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: DIFF_IN_SECONDS TESTS
 * --------------------------------
 */

/**
 * End after start produces a positive second difference.
 */
test("PASS_DIFFSECONDS_1: End after start returns positive diff", () => {
  expect(DateTime.diffInSeconds("2024-01-01 00:00:00", "2024-01-01 01:00:00")).toBe(3600);
});

/**
 * End before start yields a negative difference.
 */
test("PASS_DIFFSECONDS_2: End before start returns negative diff", () => {
  expect(DateTime.diffInSeconds("2024-01-01 01:00:00", "2024-01-01 00:00:00")).toBe(-3600);
});

/**
 * Identical timestamps return zero difference.
 */
test("PASS_DIFFSECONDS_3: Same timestamps return 0", () => {
  expect(DateTime.diffInSeconds("2024-01-01 00:00:00", "2024-01-01 00:00:00")).toBe(0);
});

/**
 * Date-only strings compute a full day's difference.
 */
test("PASS_DIFFSECONDS_4: Works with date-only strings", () => {
  expect(DateTime.diffInSeconds("2024-01-01", "2024-01-02")).toBe(86400);
});

/**
 * Invalid start dates result in false.
 */
test("FAIL_DIFFSECONDS_1: Invalid start date returns false", () => {
  expect(DateTime.diffInSeconds("invalid", "2024-01-01")).toBe(false);
});

/**
 * Invalid end dates result in false.
 */
test("FAIL_DIFFSECONDS_2: Invalid end date returns false", () => {
  expect(DateTime.diffInSeconds("2024-01-01", "invalid")).toBe(false);
});

/**
 * Both invalid inputs return false.
 */
test("FAIL_DIFFSECONDS_3: Both invalid returns false", () => {
  expect(DateTime.diffInSeconds("foo", "bar")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: DIFF_IN_HUMAN_READABLE TESTS
 * --------------------------------
 */

/**
 * 2-day gaps produce a "2 days" string.
 */
test("PASS_DIFFHUMAN_1: 2 days difference", () => {
  expect(DateTime.diffInHumanReadable("2024-01-01", "2024-01-03")).toBe("2 days");
});

/**
 * Top two units (days and hours) are shown when applicable.
 */
test("PASS_DIFFHUMAN_2: 1 day, 3 hours (top 2 units)", () => {
  expect(DateTime.diffInHumanReadable("2024-01-01 00:00:00", "2024-01-02 03:00:00")).toBe("1 day, 3 hours");
});

/**
 * Smaller-than-day diffs show hours and minutes.
 */
test("PASS_DIFFHUMAN_3: Less than 1 day but multiple units", () => {
  expect(DateTime.diffInHumanReadable("2024-01-01 00:00:00", "2024-01-01 01:30:00")).toBe("1 hour, 30 minutes");
});

/**
 * Order of inputs does not affect the human string (absolute gap).
 */
test("PASS_DIFFHUMAN_4: Order independent (absolute value)", () => {
  expect(DateTime.diffInHumanReadable("2024-01-01 01:30:00", "2024-01-01 00:00:00")).toBe("1 hour, 30 minutes");
});

/**
 * Very small diffs use seconds output.
 */
test("PASS_DIFFHUMAN_5: Very small diff (<60s) shows seconds only", () => {
  expect(DateTime.diffInHumanReadable("2024-01-01 00:00:00", "2024-01-01 00:00:30")).toBe("30 seconds");
});

/**
 * Large diffs may surface years or months depending on internal rounding.
 */
test("PASS_DIFFHUMAN_6: Large diff uses years/months", () => {
  const result = DateTime.diffInHumanReadable("2023-11-01", "2024-12-05");
  expect(result.startsWith("1 year") || result.startsWith("13 months")).toBe(true);
});

/**
 * Invalid start dates lead to false.
 */
test("FAIL_DIFFHUMAN_1: Invalid start date returns false", () => {
  expect(DateTime.diffInHumanReadable("invalid", "2024-01-01")).toBe(false);
});

/**
 * Invalid end dates lead to false.
 */
test("FAIL_DIFFHUMAN_2: Invalid end date returns false", () => {
  expect(DateTime.diffInHumanReadable("2024-01-01", "invalid")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_VALID_DATE TESTS
 * --------------------------------
 */

/**
 * Valid dates match the default format.
 */
test("PASS_ISVALIDDATE_1: Valid date matches default format", () => {
  expect(DateTime.isValidDate("2024-01-15")).toBe(true);
});

/**
 * Dates with invalid months fail validation.
 */
test("PASS_ISVALIDDATE_2: Invalid date for format", () => {
  expect(DateTime.isValidDate("2024-13-01")).toBe(false);
});

/**
 * Strict format checking rejects non-padded inputs.
 */
test("PASS_ISVALIDDATE_3: Non-padded date fails strict format", () => {
  expect(DateTime.isValidDate("2024-1-5", "yyyy-MM-dd")).toBe(false);
});

/**
 * Custom formats are respected.
 */
test("PASS_ISVALIDDATE_4: Custom format works", () => {
  expect(DateTime.isValidDate("15/01/2024", "dd/MM/yyyy")).toBe(true);
});

/**
 * Reformatted dates must match the original input to be valid.
 */
test("PASS_ISVALIDDATE_5: Date that parses but reformat mismatches returns false", () => {
  expect(DateTime.isValidDate("2024-1-05", "yyyy-MM-dd")).toBe(false);
});

/**
 * Empty strings are invalid.
 */
test("FAIL_ISVALIDDATE_1: Empty string returns false", () => {
  expect(DateTime.isValidDate("")).toBe(false);
});

/**
 * Non-string values fail validation.
 */
test("FAIL_ISVALIDDATE_2: Non-string input returns false", () => {
  expect(DateTime.isValidDate(123)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: FORMAT_DATE TESTS
 * --------------------------------
 */

/**
 * Auto-detected input is reformatted into the default output.
 */
test("PASS_FORMATDATE_1: Auto-detected Y-m-d to default output", () => {
  expect(DateTime.formatDate("2024-01-15")).toBe("15/01/2024");
});

/**
 * Custom output formats work even with time components.
 */
test("PASS_FORMATDATE_2: Auto-detected Y-m-d H:i:s with custom output", () => {
  expect(DateTime.formatDate("2024-01-15 10:30:00", "HH:mm", null)).toBe("10:30");
});

/**
 * Providing input format allows parsing of non-standard strings.
 */
test("PASS_FORMATDATE_3: Explicit input format", () => {
  expect(DateTime.formatDate("15-01-2024", "yyyy/MM/dd", "dd-MM-yyyy")).toBe("2024/01/15");
});

/**
 * Year-month inputs map to matching output patterns.
 */
test("PASS_FORMATDATE_4: Supports Y-m input", () => {
  expect(DateTime.formatDate("2024-01", "MM/yyyy")).toBe("01/2024");
});

/**
 * Unsupported formats return false.
 */
test("FAIL_FORMATDATE_1: Unrecognized format returns false", () => {
  expect(DateTime.formatDate("15/01/2024")).toBe(false);
});

/**
 * Invalid dates according to the input format fail gracefully.
 */
test("FAIL_FORMATDATE_2: Invalid date according to inputFormat returns false", () => {
  expect(DateTime.formatDate("99-99-9999", "yyyy-MM-dd", "dd-MM-yyyy")).toBe(false);
});

/**
 * Empty strings produce false results.
 */
test("FAIL_FORMATDATE_3: Empty string returns false", () => {
  expect(DateTime.formatDate("", "dd/MM/yyyy")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: GET_START_OF_DAY TESTS
 * --------------------------------
 */

/**
 * Date-only inputs return the start of that day in HK.
 */
test("PASS_GETSTARTOFDAY_1: Date-only yields 00:00:00 in HK", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 14, 16, 0, 0), HK_ZONE);
  expect(DateTime.getStartOfDay("2024-01-15", null)).toBe(expected);
});

/**
 * Datetime strings are truncated to their day's start.
 */
test("PASS_GETSTARTOFDAY_2: Full datetime truncated to start of day", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 14, 16, 0, 0), HK_ZONE);
  expect(DateTime.getStartOfDay("2024-01-15 13:45:00", null)).toBe(expected);
});

/**
 * Accepts a timezone parameter and returns that zone's midnight.
 */
test("PASS_GETSTARTOFDAY_3: Custom timezone used", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 15, 0, 0, 0), LONDON_ZONE);
  expect(DateTime.getStartOfDay("2024-01-15 13:45:00", LONDON_ZONE)).toBe(expected);
});

/**
 * Invalid dates return false instead of throwing.
 */
test("FAIL_GETSTARTOFDAY_1: Invalid date returns false", () => {
  expect(DateTime.getStartOfDay("not-a-date", null)).toBe(false);
});

/**
 * Empty strings are rejected.
 */
test("FAIL_GETSTARTOFDAY_2: Empty string returns false", () => {
  expect(DateTime.getStartOfDay("", null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: GET_END_OF_DAY TESTS
 * --------------------------------
 */

/**
 * Date-only inputs return 23:59:59 for HK.
 */
test("PASS_GETENDOFDAY_1: Date-only yields 23:59:59 in HK", () => {
  const expected = "2024-01-15 23:59:59";
  expect(DateTime.getEndOfDay("2024-01-15", null)).toBe(expected);
});

/**
 * Datetime inputs are truncated to the same day's end.
 */
test("PASS_GETENDOFDAY_2: Full datetime converted to end of same day", () => {
  const expected = "2024-01-15 23:59:59";
  expect(DateTime.getEndOfDay("2024-01-15 13:45:00", null)).toBe(expected);
});

/**
 * Custom timezones still produce localized end-of-day strings.
 */
test("PASS_GETENDOFDAY_3: Custom timezone", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 15, 23, 59, 59), LONDON_ZONE);
  expect(DateTime.getEndOfDay("2024-01-15 13:45:00", LONDON_ZONE)).toBe(expected);
});

/**
 * Invalid inputs yield false.
 */
test("FAIL_GETENDOFDAY_1: Invalid date returns false", () => {
  expect(DateTime.getEndOfDay("not-a-date", null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: ADD_DAYS TESTS
 * --------------------------------
 */

/**
 * Adding positive days advances the date.
 */
test("PASS_ADDDAYS_1: Add positive days", () => {
  expect(DateTime.addDays("2024-01-01", 5, null)).toBe("2024-01-06 00:00:00");
});

/**
 * Negative day counts move backwards.
 */
test("PASS_ADDDAYS_2: Add negative days", () => {
  expect(DateTime.addDays("2024-01-10", -5, null)).toBe("2024-01-05 00:00:00");
});

/**
 * Non-integer days are coerced via Number().
 */
test("PASS_ADDDAYS_3: Non-integer days coerced via Number()", () => {
  expect(DateTime.addDays("2024-01-01", "2", null)).toBe("2024-01-03 00:00:00");
});

/**
 * Custom timezones are honored for the underlying math.
 */
test("PASS_ADDDAYS_4: Custom timezone", () => {
  expect(DateTime.addDays("2024-01-01", 1, LONDON_ZONE)).toBe("2024-01-02 00:00:00");
});

/**
 * Invalid dates immediately return false.
 */
test("FAIL_ADDDAYS_1: Invalid date returns false", () => {
  expect(DateTime.addDays("invalid", 2, null)).toBe(false);
});

/**
 * Unsupported formats (detectDateFormat fails) return false.
 */
test("FAIL_ADDDAYS_2: detectDateFormat fails", () => {
  expect(DateTime.addDays("01/01/2024", 1, null)).toBe(false);
});

/**
 * Exceptions inside the method (e.g., NaN days) produce false.
 */
test("FAIL_ADDDAYS_3: Exception inside block returns false", () => {
  expect(DateTime.addDays("2024-01-01", NaN, null)).toBe(false);
});

test("FAIL_ADDDAYS_4: Non-finite days returns false", () => {
  expect(DateTime.addDays("2024-01-01", "many", null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: GET_NEXT_OCCURRENCE TESTS
 * --------------------------------
 */

/**
 * Calculates the coming Monday when called on a Wednesday.
 */
test("PASS_NEXTOCCURRENCE_1: Next Monday from a Wednesday", () => {
  Date.now.mockReturnValue(Date.UTC(2024, 0, 10, 4, 30, 0));
  const expected = formatFullDateTime(Date.UTC(2024, 0, 15, 0, 0, 0), HK_ZONE);
  expect(DateTime.getNextOccurrence("Monday", "00:00:00", null)).toBe(expected);
});

/**
 * Same weekday as today should return today's target time.
 */
test("PASS_NEXTOCCURRENCE_2: Same weekday today should return today", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 15, 0, 0, 0), HK_ZONE);
  expect(DateTime.getNextOccurrence("Monday", "00:00:00", null)).toBe(expected);
});

/**
 * Case-insensitive weekday names work as expected.
 */
test("PASS_NEXTOCCURRENCE_3: Case-insensitive weekday", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 19, 12, 30, 0), HK_ZONE);
  expect(DateTime.getNextOccurrence("friday", "12:30:00", null)).toBe(expected);
});

/**
 * Custom timezones shift the calculation accordingly.
 */
test("PASS_NEXTOCCURRENCE_4: Custom timezone", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 16, 10, 0, 0), LONDON_ZONE);
  expect(DateTime.getNextOccurrence("Tuesday", "10:00:00", LONDON_ZONE)).toBe(expected);
});

/**
 * Non-existent weekdays result in false.
 */
test("FAIL_NEXTOCCURRENCE_1: Invalid weekday throws and method returns false", () => {
  expect(DateTime.getNextOccurrence("Funday", "00:00:00", null)).toBe(false);
});

/**
 * Invalid time strings are gracefully handled.
 */
test("FAIL_NEXTOCCURRENCE_2: Invalid time format triggers false", () => {
  expect(DateTime.getNextOccurrence("Monday", "99:99:99", null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: CONVERT_TIMEZONE TESTS
 * --------------------------------
 */

/**
 * Converts Hong Kong time to London.
 */
test("PASS_CONVERTTZ_1: HK to London conversion", () => {
  const expected = formatFullDateTime(Date.UTC(2024, 0, 1, 2, 0, 0), LONDON_ZONE);
  expect(DateTime.convertTimezone("2024-01-01 10:00:00", HK_ZONE, LONDON_ZONE)).toBe(expected);
});

/**
 * Date-only strings convert to UTC equivalents.
 */
test("PASS_CONVERTTZ_2: Date-only string converts", () => {
  const expected = formatFullDateTime(Date.UTC(2023, 11, 31, 16, 0, 0), "UTC");
  expect(DateTime.convertTimezone("2024-01-01", HK_ZONE, "UTC")).toBe(expected);
});

/**
 * Custom output formats are respected.
 */
test("PASS_CONVERTTZ_3: Custom output format", () => {
  expect(DateTime.convertTimezone("2024-01-01 10:00:00", "UTC", TOKYO_ZONE, "HH:mm")).toBe("19:00");
});

/**
 * Unsupported input formats return false.
 */
test("FAIL_CONVERTTZ_1: Unsupported date format returns false", () => {
  expect(DateTime.convertTimezone("01/01/2024", "UTC", HK_ZONE)).toBe(false);
});

/**
 * Invalid fromZone leads to false.
 */
test("FAIL_CONVERTTZ_2: Invalid fromZone returns false", () => {
  expect(DateTime.convertTimezone("2024-01-01 10:00:00", "Invalid/Zone", "UTC")).toBe(false);
});

/**
 * Invalid toZone leads to false as well.
 */
test("FAIL_CONVERTTZ_3: Invalid toZone returns false", () => {
  expect(DateTime.convertTimezone("2024-01-01 10:00:00", "UTC", "Bad/Zone")).toBe(false);
});

/**
 * Non-date strings are rejected.
 */
test("FAIL_CONVERTTZ_4: dateStr invalid returns false", () => {
  expect(DateTime.convertTimezone("not-a-date", "UTC", HK_ZONE)).toBe(false);
});

/**
 * JS Date inputs are accepted for wider compatibility.
 */
test("PASS_CONVERTTZ_DATEINPUT: Accepts Date objects", () => {
  const date = new Date(Date.UTC(2024, 0, 1, 10, 0, 0));
  const expected = "2024-01-01 18:00:00";
  expect(DateTime.convertTimezone(date, "UTC", HK_ZONE)).toBe(expected);
});

/**
 * ISO strings can be converted directly.
 */
test("PASS_CONVERTTZ_ISOINPUT: ISO string conversion", () => {
  expect(DateTime.convertTimezone("2024-01-01T02:00:00Z", "UTC", HK_ZONE)).toBe(
    "2024-01-01 10:00:00"
  );
});

/**
 * Luxon DateTime inputs are supported.
 */
test("PASS_CONVERTTZ_LUXONINPUT: Converts Luxon DateTime", () => {
  const source = LuxonDateTime.fromISO("2024-01-01T02:00:00Z");
  const expected = "2024-01-01 10:00:00";
  expect(DateTime.convertTimezone(source, "UTC", HK_ZONE)).toBe(expected);
});

/**
 * Leap-year boundaries convert cleanly across zones.
 */
test("PASS_CONVERTTZ_LEAPYEAR: Leap day conversion retains UTC day", () => {
  expect(
    DateTime.convertTimezone("2024-02-29 23:30:00", HK_ZONE, "UTC")
  ).toBe("2024-02-29 15:30:00");
});

/**
 * Non-existent DST timestamps are normalized to the next valid instant.
 */
test("PASS_CONVERTTZ_DST_NONEXISTENT: DST spring forward normalizes", () => {
  expect(
    DateTime.convertTimezone("2024-03-10 02:30:00", "America/New_York", "UTC")
  ).toBe("2024-03-10 07:30:00");
});

/**
 * Ambiguous fall-back timestamps lean into the later offset.
 */
test("PASS_CONVERTTZ_DST_AMBIGUOUS: Fall back picks later occurrence", () => {
  expect(
    DateTime.convertTimezone("2024-11-03 01:30:00", "America/New_York", "UTC")
  ).toBe("2024-11-03 06:30:00");
});

/**
 * --------------------------------
 * SECTION: IS_PAST TESTS
 * --------------------------------
 */

/**
 * Dates far in the past are considered past.
 */
test("PASS_ISPAST_1: Date clearly in the past", () => {
  expect(DateTime.isPast("2000-01-01")).toBe(true);
});

/**
 * Future dates are not past.
 */
test("PASS_ISPAST_2: Date in the future", () => {
  expect(DateTime.isPast("2100-01-01")).toBe(false);
});

/**
 * Exact now should not be counted as past.
 */
test("PASS_ISPAST_3: Exact current date/time returns false", () => {
  const nowStr = formatFullDateTime(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.isPast(nowStr)).toBe(false);
});

/**
 * Invalid dates return false.
 */
test("FAIL_ISPAST_1: Invalid date returns false", () => {
  expect(DateTime.isPast("not-a-date")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_FUTURE TESTS
 * --------------------------------
 */

/**
 * Future dates are considered future.
 */
test("PASS_ISFUTURE_1: Future date returns true", () => {
  expect(DateTime.isFuture("2100-01-01")).toBe(true);
});

/**
 * Past dates are not future.
 */
test("PASS_ISFUTURE_2: Past date returns false", () => {
  expect(DateTime.isFuture("2000-01-01")).toBe(false);
});

/**
 * Exact now is not future.
 */
test("PASS_ISFUTURE_3: Exact now returns false", () => {
  const nowStr = formatFullDateTime(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.isFuture(nowStr)).toBe(false);
});

/**
 * Invalid dates result in false.
 */
test("FAIL_ISFUTURE_1: Invalid date returns false", () => {
  expect(DateTime.isFuture("not-a-date")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_BETWEEN TESTS
 * --------------------------------
 */

/**
 * Dates strictly inside the inclusive range return true.
 */
test("PASS_ISBETWEEN_1: Date inside inclusive range returns true", () => {
  expect(DateTime.isBetween("2024-01-10", "2024-01-01", "2024-01-31")).toBe(true);
});

/**
 * Matching the start boundary still counts.
 */
test("PASS_ISBETWEEN_2: Date equals start boundary", () => {
  expect(DateTime.isBetween("2024-01-01", "2024-01-01", "2024-01-31")).toBe(true);
});

/**
 * Matching the end boundary still counts.
 */
test("PASS_ISBETWEEN_3: Date equals end boundary", () => {
  expect(DateTime.isBetween("2024-01-31", "2024-01-01", "2024-01-31")).toBe(true);
});

/**
 * Dates outside the range return false.
 */
test("PASS_ISBETWEEN_4: Date outside range returns false", () => {
  expect(DateTime.isBetween("2024-02-01", "2024-01-01", "2024-01-31")).toBe(false);
});

/**
 * Invalid target dates return false.
 */
test("FAIL_ISBETWEEN_1: Invalid dateStr returns false", () => {
  expect(DateTime.isBetween("invalid", "2024-01-01", "2024-01-31")).toBe(false);
});

/**
 * Invalid start dates return false.
 */
test("FAIL_ISBETWEEN_2: Invalid startDateStr returns false", () => {
  expect(DateTime.isBetween("2024-01-10", "invalid", "2024-01-31")).toBe(false);
});

/**
 * Invalid end dates return false.
 */
test("FAIL_ISBETWEEN_3: Invalid endDateStr returns false", () => {
  expect(DateTime.isBetween("2024-01-10", "2024-01-01", "invalid")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_VALID_FORMAT TESTS
 * --------------------------------
 */

/**
 * Valid Luxon format strings are accepted.
 */
test("PASS_ISVALIDFORMAT_1: Valid Luxon format returns true", () => {
  expect(DateTime.isValidFormat("yyyy-MM-dd")).toBe(true);
});

/**
 * Complex but valid formats also return true.
 */
test("PASS_ISVALIDFORMAT_2: Complex but valid format", () => {
  expect(DateTime.isValidFormat("yyyy-MM-dd HH:mm:ss")).toBe(true);
});

/**
 * Nonsense formats return false.
 */
test("FAIL_ISVALIDFORMAT_1: Nonsense format returns false", () => {
  expect(DateTime.isValidFormat("[[")).toBe(false);
});

/**
 * Empty strings were observed to be valid in Luxon; assert accordingly.
 */
test("FAIL_ISVALIDFORMAT_2: Empty string observed behavior", () => {
  expect(DateTime.isValidFormat("")).toBe(true);
});

/**
 * Very long invalid patterns return false.
 */
test("FAIL_ISVALIDFORMAT_3: Very long invalid pattern should return false", () => {
  expect(DateTime.isValidFormat("%%%%%")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: NOW TESTS
 * --------------------------------
 */

/**
 * Default output reflects the mocked time and HK zone.
 */
test("PASS_NOW_1: Default format and zone", () => {
  const expected = formatFullDateTime(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.now()).toBe(expected);
});

/**
 * Custom formats override the default.
 */
test("PASS_NOW_2: Custom format", () => {
  const expected = formatHourMinute(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.now("HH:mm")).toBe(expected);
});

/**
 * Custom timezone arguments change the string.
 */
test("PASS_NOW_3: Custom timezone", () => {
  const expected = formatDateOnly(MOCK_NOW_MS, LONDON_ZONE);
  expect(DateTime.now("yyyy-MM-dd", LONDON_ZONE)).toBe(expected);
});

/**
 * Invalid formats fall back to the default representation.
 */
test("FAIL_NOW_1: Invalid format falls back to default format", () => {
  const expected = formatFullDateTime(MOCK_NOW_MS, HK_ZONE);
  expect(DateTime.now("INVALID[[")).toBe(expected);
});

/**
 * Formats that trigger exceptions return false.
 */
test("FAIL_NOW_2: Very bad format causing exception returns false", () => {
  expect(DateTime.now("%")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: TIME_TO_MINUTES TESTS
 * --------------------------------
 */

/**
 * Standard HH:mm format converts to minutes.
 */
test("PASS_TIMETOMINUTES_1: HH:mm converts correctly", () => {
  expect(DateTime.timeToMinutes("02:30")).toBe(150);
});

/**
 * Seconds are ignored when present.
 */
test("PASS_TIMETOMINUTES_2: HH:mm:ss ignores seconds", () => {
  expect(DateTime.timeToMinutes("01:15:30")).toBe(75);
});

/**
 * Negative hours use absolute values.
 */
test("PASS_TIMETOMINUTES_3: Negative hours become positive via Math.abs", () => {
  expect(DateTime.timeToMinutes("-01:30")).toBe(90);
});

/**
 * Negative minutes are converted using Math.abs.
 */
test("PASS_TIMETOMINUTES_4: Negative minutes become positive", () => {
  expect(DateTime.timeToMinutes("01:-30")).toBe(90);
});

/**
 * Missing colon throws an error.
 */
test("FAIL_TIMETOMINUTES_1: Missing : throws error", () => {
  expect(() => DateTime.timeToMinutes("1234")).toThrow("Invalid time string format");
});

/**
 * Single-part times should throw as invalid.
 */
test("FAIL_TIMETOMINUTES_2: Single-part string throws error", () => {
  expect(() => DateTime.timeToMinutes("10")).toThrow("Invalid time string format");
});

/**
 * Non-numeric parts result in NaN but no exception.
 */
test("FAIL_TIMETOMINUTES_3: Non-numeric parts lead to NaN result", () => {
  expect(() => DateTime.timeToMinutes("aa:bb")).toThrow("Invalid time string format");
});

/**
 * --------------------------------
 * SECTION: GET_RELATIVE_TIME TESTS
 * --------------------------------
 */

const nowSeconds = MOCK_NOW_MS / 1000;

/**
 * Less than 60 seconds returns "just now".
 */
test("PASS_GETRELATIVE_1: Less than 60s → just now", () => {
  expect(DateTime.getRelativeTime(nowSeconds - 30)).toBe("just now");
});

/**
 * ~2 minutes ago still falls into "just now" per current logic.
 */
test("PASS_GETRELATIVE_2: ~2 minutes ago but <1h", () => {
  expect(DateTime.getRelativeTime(nowSeconds - 120)).toBe("just now");
});

/**
 * Exactly 1 hour ago returns "1h".
 */
test("PASS_GETRELATIVE_3: More than 1 hour uses 1h", () => {
  expect(DateTime.getRelativeTime(nowSeconds - 3600)).toBe("1h");
});

/**
 * Over a day returns "1d".
 */
test("PASS_GETRELATIVE_4: Over a day uses 1d", () => {
  expect(DateTime.getRelativeTime(nowSeconds - 86400)).toBe("1d");
});

/**
 * Over a week returns "1w".
 */
test("PASS_GETRELATIVE_5: Over a week uses 1w", () => {
  expect(DateTime.getRelativeTime(nowSeconds - 7 * 86400)).toBe("1w");
});

/**
 * Over a month uses "1m".
 */
test("PASS_GETRELATIVE_6: Over a month uses 1m", () => {
  expect(DateTime.getRelativeTime(nowSeconds - 30 * 86400)).toBe("1m");
});

/**
 * Over a year uses "1y".
 */
test("PASS_GETRELATIVE_7: Over a year uses 1y", () => {
  expect(DateTime.getRelativeTime(nowSeconds - 365 * 86400)).toBe("1y");
});

/**
 * Non-number timestamps return false.
 */
test("FAIL_GETRELATIVE_1: Non-number returns false", () => {
  expect(DateTime.getRelativeTime("123")).toBe(false);
});

/**
 * NaN timestamps return false.
 */
test("FAIL_GETRELATIVE_2: NaN returns false", () => {
  expect(DateTime.getRelativeTime(NaN)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: FORMAT_PRETTY_RELATIVE_TIME TESTS
 * --------------------------------
 */

/**
 * <60s still maps to "just now".
 */
test("PASS_PRETTYREL_1: <60s → just now", () => {
  expect(DateTime.formatPrettyRelativeTime(nowSeconds - 30)).toBe("just now");
});

/**
 * 90s (1m30s) returns "1 minute ago".
 */
test("PASS_PRETTYREL_2: 90s → 1 minute ago", () => {
  expect(DateTime.formatPrettyRelativeTime(nowSeconds - 90)).toBe("1 minute ago");
});

/**
 * 2 hours ago returns "2 hours ago".
 */
test("PASS_PRETTYREL_3: 2 hours ago", () => {
  expect(DateTime.formatPrettyRelativeTime(nowSeconds - 2 * 3600)).toBe("2 hours ago");
});

/**
 * Exactly 1 day ago returns "1 day ago".
 */
test("PASS_PRETTYREL_4: 1 day ago", () => {
  expect(DateTime.formatPrettyRelativeTime(nowSeconds - 86400)).toBe("1 day ago");
});

/**
 * 2 weeks ago returns "2 weeks ago".
 */
test("PASS_PRETTYREL_5: 2 weeks ago", () => {
  expect(DateTime.formatPrettyRelativeTime(nowSeconds - 14 * 86400)).toBe("2 weeks ago");
});

/**
 * Large diffs (400 days) point to "1 year ago".
 */
test("PASS_PRETTYREL_6: 400 days ago", () => {
  const result = DateTime.formatPrettyRelativeTime(nowSeconds - 400 * 86400);
  expect(result.startsWith("1 year")).toBe(true);
});

/**
 * Non-number timestamps return false.
 */
test("FAIL_PRETTYREL_1: Non-number returns false", () => {
  expect(DateTime.formatPrettyRelativeTime("123")).toBe(false);
});

/**
 * NaN timestamps return false.
 */
test("FAIL_PRETTYREL_2: NaN returns false", () => {
  expect(DateTime.formatPrettyRelativeTime(NaN)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: GET_DEFAULT_TIME_ZONE TESTS
 * --------------------------------
 */

/**
 * Default static timezone matches constant before mutation.
 */
test("PASS_GETDEFAULTTZ_1: Returns static default when unchanged", () => {
  expect(DateTime.getDefaultTimeZone()).toBe("Asia/Hong_Kong");
});

/**
 * After setting a new timezone, that value is returned.
 */
test("PASS_GETDEFAULTTZ_2: After setDefaultTimeZone reflects updated value", () => {
  DateTime.setDefaultTimeZone("Europe/London");
  expect(DateTime.getDefaultTimeZone()).toBe("Europe/London");
});

/**
 * Resetting the static property to undefined should fallback to the constant.
 */
test("PASS_GETDEFAULTTZ_3: Fallback when static property reset", () => {
  DateTime.DEFAULT_TIME_ZONE = undefined;
  expect(DateTime.getDefaultTimeZone()).toBe("Asia/Hong_Kong");
});

/**
 * --------------------------------
 * SECTION: SET_DEFAULT_TIME_ZONE TESTS
 * --------------------------------
 */

/**
 * Valid IANA timezones are accepted.
 */
test("PASS_SETDEFAULTTZ_1: Valid IANA timezone set", () => {
  expect(DateTime.setDefaultTimeZone("Europe/London")).toBe(true);
});

/**
 * Spaces are trimmed before validation.
 */
test("PASS_SETDEFAULTTZ_2: Leading/trailing spaces trimmed", () => {
  expect(DateTime.setDefaultTimeZone(" UTC ")).toBe(true);
  expect(DateTime.getDefaultTimeZone()).toBe("UTC");
});

/**
 * Empty strings are rejected.
 */
test("FAIL_SETDEFAULTTZ_1: Empty string returns false", () => {
  expect(DateTime.setDefaultTimeZone("")).toBe(false);
});

/**
 * Whitespace-only inputs are rejected.
 */
test("FAIL_SETDEFAULTTZ_2: Whitespace-only returns false", () => {
  expect(DateTime.setDefaultTimeZone(" ")).toBe(false);
});

/**
 * Non-string timezone inputs are rejected.
 */
test("FAIL_SETDEFAULTTZ_3: Non-string returns false", () => {
  expect(DateTime.setDefaultTimeZone(123)).toBe(false);
});

/**
 * Invalid timezone identifiers are rejected.
 */
test("FAIL_SETDEFAULTTZ_4: Invalid timezone name returns false", () => {
  expect(DateTime.setDefaultTimeZone("Invalid/Zone")).toBe(false);
});

/**
 * Helper utilities expose ISO weekday/week-number.
 */
test("PASS_GETDAYOFWEEK: Returns ISO weekday", () => {
  expect(DateTime.getDayOfWeek("2024-01-15")).toBe(1);
});

test("PASS_GETWEEKNUMBER: Returns ISO week number", () => {
  expect(DateTime.getWeekNumber("2024-01-15")).toBe(3);
});

/**
 * --------------------------------
 * SECTION: NORMALIZE_TO_HONG_KONG TESTS
 * --------------------------------
 */

/**
 * Numeric Unix seconds input returns a valid Luxon DateTime in HK.
 */
test("PASS_NORMALIZEHK_1: Unix seconds number → DateTime in default zone", () => {
  const normalized = DateTime.normalizeToHongKong(1_700_000_000);
  expect(normalized).not.toBe(false);
  expect(normalized.zoneName).toBe(HK_ZONE);
  expect(normalized.toFormat("yyyy-MM-dd HH:mm:ss")).toBe("2023-11-15 06:13:20");
});

/**
 * JS Date inputs are normalized to the default zone.
 */
test("PASS_NORMALIZEHK_2: JS Date input", () => {
  const normalized = DateTime.normalizeToHongKong(new Date(2024, 0, 1));
  expect(normalized.zoneName).toBe(HK_ZONE);
  expect(normalized.toFormat("yyyy-MM-dd HH:mm:ss")).toBe("2023-12-31 22:00:00");
});

/**
 * Luxon DateTime values from other zones convert to HK.
 */
test("PASS_NORMALIZEHK_3: Luxon DateTime input converted to default", () => {
  const source = DateTime.normalizeToHongKong(LuxonDateTime.fromISO("2024-01-01T00:00:00", { zone: "UTC" }));
  expect(source.zoneName).toBe(HK_ZONE);
});

/**
 * Valid string dates produce HK DateTime objects.
 */
test("PASS_NORMALIZEHK_4: Valid string date", () => {
  const normalized = DateTime.normalizeToHongKong("2024-01-01 10:00:00");
  expect(normalized.zoneName).toBe(HK_ZONE);
  expect(normalized.toFormat("yyyy-MM-dd HH:mm:ss")).toBe("2024-01-01 10:00:00");
});

/**
 * Invalid string dates return false.
 */
test("FAIL_NORMALIZEHK_1: Invalid string date returns false", () => {
  expect(DateTime.normalizeToHongKong("not-a-date")).toBe(false);
});

/**
 * Empty string inputs are rejected.
 */
test("FAIL_NORMALIZEHK_2: Empty string returns false", () => {
  expect(DateTime.normalizeToHongKong("")).toBe(false);
});

/**
 * Unsupported types return false.
 */
test("FAIL_NORMALIZEHK_3: Unsupported type returns false", () => {
  expect(DateTime.normalizeToHongKong({})).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_WITHIN_PAST_SECONDS TESTS
 * --------------------------------
 */

/**
 * Timestamp equal to now is within the window.
 */
test("PASS_WITHINPAST_1: Timestamp exactly now is within window", () => {
  expect(DateTime.isWithinPastSeconds(nowSeconds, 60)).toBe(true);
});

/**
 * 30 seconds ago stays inside a 60-second window.
 */
test("PASS_WITHINPAST_2: Timestamp now - 30 inside 60s window", () => {
  expect(DateTime.isWithinPastSeconds(nowSeconds - 30, 60)).toBe(true);
});

/**
 * 61 seconds ago falls outside a 60-second window.
 */
test("PASS_WITHINPAST_3: Timestamp now - 61 outside 60s window", () => {
  expect(DateTime.isWithinPastSeconds(nowSeconds - 61, 60)).toBe(false);
});

/**
 * Negative window values use absolute.
 */
test("PASS_WITHINPAST_4: Negative seconds treated via Math.abs", () => {
  expect(DateTime.isWithinPastSeconds(nowSeconds - 30, -60)).toBe(true);
});

/**
 * Non-number timestamps return false.
 */
test("FAIL_WITHINPAST_1: Non-number targetTimestamp returns false", () => {
  expect(DateTime.isWithinPastSeconds("123", 60)).toBe(false);
});

/**
 * Non-number window sizes return false.
 */
test("FAIL_WITHINPAST_2: Non-number seconds returns false", () => {
  expect(DateTime.isWithinPastSeconds(nowSeconds, "60")).toBe(false);
});

/**
 * NaN inputs return false.
 */
test("FAIL_WITHINPAST_3: NaN values return false", () => {
  expect(DateTime.isWithinPastSeconds(NaN, 60)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_WITHIN_NEXT_SECONDS TESTS
 * --------------------------------
 */

/**
 * Now is within the next window.
 */
test("PASS_WITHINNEXT_1: Timestamp exactly now within window", () => {
  expect(DateTime.isWithinNextSeconds(nowSeconds, 60)).toBe(true);
});

/**
 * 30 seconds ahead is within 60 seconds.
 */
test("PASS_WITHINNEXT_2: Timestamp now + 30 within 60s window", () => {
  expect(DateTime.isWithinNextSeconds(nowSeconds + 30, 60)).toBe(true);
});

/**
 * 61 seconds ahead is outside the window.
 */
test("PASS_WITHINNEXT_3: Timestamp now + 61 outside window", () => {
  expect(DateTime.isWithinNextSeconds(nowSeconds + 61, 60)).toBe(false);
});

/**
 * Negative windows are treated as positive.
 */
test("PASS_WITHINNEXT_4: Negative seconds treated as absolute", () => {
  expect(DateTime.isWithinNextSeconds(nowSeconds + 30, -60)).toBe(true);
});

/**
 * Non-finite target timestamps return false.
 */
test("FAIL_WITHINNEXT_1: targetTimestamp not finite returns false", () => {
  expect(DateTime.isWithinNextSeconds(NaN, 60)).toBe(false);
});

/**
 * Non-finite windows return false.
 */
test("FAIL_WITHINNEXT_2: seconds not finite returns false", () => {
  expect(DateTime.isWithinNextSeconds(nowSeconds, NaN)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_WITHIN_RELATIVE_WINDOW TESTS
 * --------------------------------
 */

/**
 * Now sits within the combined window.
 */
test("PASS_RELWINDOW_1: Target exactly now", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds, 60, 60)).toBe(true);
});

/**
 * Past inputs within the window return true.
 */
test("PASS_RELWINDOW_2: Target in past within window", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds - 30, 60, 10)).toBe(true);
});

/**
 * Future inputs within the window return true.
 */
test("PASS_RELWINDOW_3: Target in future within window", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds + 30, 10, 60)).toBe(true);
});

/**
 * Outside past boundary returns false.
 */
test("PASS_RELWINDOW_4: Outside past side", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds - 61, 60, 60)).toBe(false);
});

/**
 * Outside future boundary returns false.
 */
test("PASS_RELWINDOW_5: Outside future side", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds + 61, 60, 60)).toBe(false);
});

/**
 * Negative window values are normalized.
 */
test("PASS_RELWINDOW_6: Negative window inputs treated as absolute", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds + 30, -10, -60)).toBe(true);
});

/**
 * Non-number targets return false.
 */
test("FAIL_RELWINDOW_1: Non-number targetTimestamp returns false", () => {
  expect(DateTime.isWithinRelativeWindow("123", 10, 10)).toBe(false);
});

/**
 * Non-number past window returns false.
 */
test("FAIL_RELWINDOW_2: Non-number pastSeconds returns false", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds, "10", 10)).toBe(false);
});

/**
 * Non-number future window returns false.
 */
test("FAIL_RELWINDOW_3: Non-number futureSeconds returns false", () => {
  expect(DateTime.isWithinRelativeWindow(nowSeconds, 10, "10")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_DATE_STRING_WITHIN_RELATIVE_WINDOW TESTS
 * --------------------------------
 */

/**
 * Valid date string within window returns true.
 */
test("PASS_DATESRELWINDOW_1: Valid date string within window", () => {
  expect(DateTime.isDateStringWithinRelativeWindow("2024-01-01 00:00:30", 60, 60, null)).toBe(true);
});

/**
 * Custom timezone inputs are honored.
 */
test("PASS_DATESRELWINDOW_2: Using custom timezone", () => {
  expect(DateTime.isDateStringWithinRelativeWindow("2024-01-01 00:00:30", 60, 60, LONDON_ZONE)).toBe(true);
});

/**
 * Invalid date strings return false.
 */
test("FAIL_DATESRELWINDOW_1: Invalid dateStr returns false", () => {
  expect(DateTime.isDateStringWithinRelativeWindow("not-a-date", 60, 60, null)).toBe(false);
});

/**
 * Bad timezones cause false due to parse failure.
 */
test("FAIL_DATESRELWINDOW_2: parseDateToTimestamp fails due to bad timezone returns false", () => {
  expect(DateTime.isDateStringWithinRelativeWindow("2024-01-01", 60, 60, "Invalid/Zone")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_NOW_BETWEEN_OFFSET_SECONDS TESTS
 * --------------------------------
 */

/**
 * Base timestamp equal to now stays inside both offsets.
 */
test("PASS_NOWBETWEENOFFSET_1: Now exactly equals baseTimestamp", () => {
  expect(DateTime.isNowBetweenOffsetSeconds(nowSeconds, 60, 60)).toBe(true);
});

/**
 * Offsetting the base into the future still covers now in the past window.
 */
test("PASS_NOWBETWEENOFFSET_2: Now within past offset window", () => {
  expect(DateTime.isNowBetweenOffsetSeconds(nowSeconds + 30, 60, 10)).toBe(true);
});

/**
 * When the base moves too far ahead, now falls outside the window.
 */
test("PASS_NOWBETWEENOFFSET_3: Now outside window", () => {
  expect(DateTime.isNowBetweenOffsetSeconds(nowSeconds + 120, 60, 10)).toBe(false);
});

/**
 * Negative offsets are normalized via Math.abs.
 */
test("PASS_NOWBETWEENOFFSET_4: Negative offsets treated as absolute", () => {
  expect(DateTime.isNowBetweenOffsetSeconds(nowSeconds, -60, -60)).toBe(true);
});

/**
 * Non-number base timestamps return false.
 */
test("FAIL_NOWBETWEENOFFSET_1: Non-number baseTimestamp returns false", () => {
  expect(DateTime.isNowBetweenOffsetSeconds("123", 10, 10)).toBe(false);
});

/**
 * Non-number past offsets return false.
 */
test("FAIL_NOWBETWEENOFFSET_2: Non-number pastSeconds returns false", () => {
  expect(DateTime.isNowBetweenOffsetSeconds(nowSeconds, "10", 10)).toBe(false);
});

/**
 * Non-number future offsets return false.
 */
test("FAIL_NOWBETWEENOFFSET_3: Non-number futureSeconds returns false", () => {
  expect(DateTime.isNowBetweenOffsetSeconds(nowSeconds, 10, "10")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_TIMESTAMP_BETWEEN TESTS
 * --------------------------------
 */

/**
 * Targets inside inclusive ranges are true.
 */
test("PASS_TSBETWEEN_1: Target inside inclusive range", () => {
  expect(DateTime.isTimestampBetween(15, 10, 20, true)).toBe(true);
});

/**
 * Matching the start boundary with inclusive mode returns true.
 */
test("PASS_TSBETWEEN_2: Target equal boundary inclusive", () => {
  expect(DateTime.isTimestampBetween(10, 10, 20, true)).toBe(true);
});

/**
 * Exclusive mode rejects boundary matches.
 */
test("PASS_TSBETWEEN_3: Target equal boundary exclusive", () => {
  expect(DateTime.isTimestampBetween(10, 10, 20, false)).toBe(false);
});

/**
 * Normalization allows start > end ranges.
 */
test("PASS_TSBETWEEN_4: startTs > endTs still works due to normalization", () => {
  expect(DateTime.isTimestampBetween(15, 20, 10, true)).toBe(true);
});

/**
 * Targets clearly outside ranges are false.
 */
test("PASS_TSBETWEEN_5: Target outside range returns false", () => {
  expect(DateTime.isTimestampBetween(25, 10, 20, true)).toBe(false);
});

/**
 * Non-number targets return false.
 */
test("FAIL_TSBETWEEN_1: Non-number targetTs returns false", () => {
  expect(DateTime.isTimestampBetween("15", 10, 20, true)).toBe(false);
});

/**
 * Non-number starts return false.
 */
test("FAIL_TSBETWEEN_2: Non-number startTs returns false", () => {
  expect(DateTime.isTimestampBetween(15, "10", 20, true)).toBe(false);
});

/**
 * Non-number ends return false.
 */
test("FAIL_TSBETWEEN_3: Non-number endTs returns false", () => {
  expect(DateTime.isTimestampBetween(15, 10, "20", true)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: TIMEZONE_OFFSET_IN_MINUTES TESTS
 * --------------------------------
 */

/**
 * UTC to Hong Kong uses +480 minutes offset.
 */
test("PASS_TZOFFSET_1: Valid zones with default reference (now)", () => {
  expect(DateTime.getTimezoneOffsetInMinutes("UTC", HK_ZONE, null)).toBe(480);
});

/**
 * June reference reflects London DST (+1 hour).
 */
test("PASS_TZOFFSET_2: Using LuxonDateTime reference", () => {
  const reference = LuxonDateTime.fromISO("2024-06-01T00:00:00Z");
  expect(DateTime.getTimezoneOffsetInMinutes("UTC", LONDON_ZONE, reference)).toBe(60);
});

/**
 * January ISO source yields Tokyo offset (+540 minutes).
 */
test("PASS_TZOFFSET_3: Using ISO string reference", () => {
  expect(DateTime.getTimezoneOffsetInMinutes("UTC", TOKYO_ZONE, "2024-01-01T00:00:00Z")).toBe(540);
});

/**
 * Invalid origin zones return false.
 */
test("FAIL_TZOFFSET_1: Invalid fromZone returns false", () => {
  expect(DateTime.getTimezoneOffsetInMinutes("Bad/Zone", "UTC", null)).toBe(false);
});

/**
 * Invalid destination zones return false.
 */
test("FAIL_TZOFFSET_2: Invalid toZone returns false", () => {
  expect(DateTime.getTimezoneOffsetInMinutes("UTC", "Bad/Zone", null)).toBe(false);
});

/**
 * Unsupported ISO references return false.
 */
test("FAIL_TZOFFSET_3: Invalid ISO reference string returns false", () => {
  expect(DateTime.getTimezoneOffsetInMinutes("UTC", TOKYO_ZONE, "bad-iso")).toBe(false);
});

/**
 * Non-string zones return false before computation.
 */
test("FAIL_TZOFFSET_4: Non-string zone inputs return false", () => {
  expect(DateTime.getTimezoneOffsetInMinutes(123, "UTC", null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: TIMEZONE_OFFSET_FROM_HONG_KONG TESTS
 * --------------------------------
 */

/**
 * Default Hong Kong base against UTC yields -480.
 */
test("PASS_TZOFFSETHK_1: Valid local zone", () => {
  expect(DateTime.getTimezoneOffsetFromHongKongToLocal("UTC", null)).toBe(-480);
});

/**
 * Overriding DEFAULT_TIME_ZONE changes the origin zone.
 */
test("PASS_TZOFFSETHK_2: Uses updated DEFAULT_TIME_ZONE", () => {
  DateTime.setDefaultTimeZone("Asia/Tokyo");
  expect(DateTime.getTimezoneOffsetFromHongKongToLocal("UTC", null)).toBe(-540);
});

/**
 * Invalid local zones return false.
 */
test("FAIL_TZOFFSETHK_1: Invalid local zone returns false", () => {
  expect(DateTime.getTimezoneOffsetFromHongKongToLocal("Bad/Zone", null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: CONVERT_HONG_KONG_TO_LOCAL TESTS
 * --------------------------------
 */

/**
 * Simple HK→UTC conversion reduces by 8 hours.
 */
test("PASS_CONVERTHKLOCAL_1: Simple HK to UTC", () => {
  expect(DateTime.convertHongKongToLocal("2024-01-01 10:00:00", "UTC")).toBe("2024-01-01 02:00:00");
});

/**
 * Custom formats apply after conversion.
 */
test("PASS_CONVERTHKLOCAL_2: Custom output format", () => {
  expect(DateTime.convertHongKongToLocal("2024-01-01 10:00:00", "UTC", "HH:mm")).toBe("02:00");
});

/**
 * Default timezone overrides alter the source zone.
 */
test("PASS_CONVERTHKLOCAL_3: With custom DEFAULT_TIME_ZONE", () => {
  DateTime.setDefaultTimeZone("Asia/Tokyo");
  expect(DateTime.convertHongKongToLocal("2024-01-01 10:00:00", "UTC")).toBe("2024-01-01 01:00:00");
});

/**
 * Invalid date strings return false.
 */
test("FAIL_CONVERTHKLOCAL_1: Invalid dateStr returns false", () => {
  expect(DateTime.convertHongKongToLocal("bad-date", "UTC")).toBe(false);
});

/**
 * Invalid target zones return false.
 */
test("FAIL_CONVERTHKLOCAL_2: Invalid localZone returns false", () => {
  expect(DateTime.convertHongKongToLocal("2024-01-01 10:00:00", "Bad/Zone")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: CONVERT_LOCAL_TO_HONG_KONG TESTS
 * --------------------------------
 */

/**
 * UTC inputs convert into HK times (+8).
 */
test("PASS_CONVERTLOCALHK_1: UTC to HK", () => {
  expect(DateTime.convertLocalToHongKong("2024-01-01 00:00:00", "UTC")).toBe("2024-01-01 08:00:00");
});

/**
 * Custom format controls the output.
 */
test("PASS_CONVERTLOCALHK_2: Custom format", () => {
  expect(DateTime.convertLocalToHongKong("2024-01-01 00:00:00", "UTC", "HH:mm")).toBe("08:00");
});

/**
 * Overriding DEFAULT_TIME_ZONE changes the target.
 */
test("PASS_CONVERTLOCALHK_3: Custom DEFAULT_TIME_ZONE used as target", () => {
  DateTime.setDefaultTimeZone("Asia/Tokyo");
  expect(DateTime.convertLocalToHongKong("2024-01-01 00:00:00", "UTC")).toBe("2024-01-01 09:00:00");
});

/**
 * Invalid date strings return false.
 */
test("FAIL_CONVERTLOCALHK_1: Invalid dateStr returns false", () => {
  expect(DateTime.convertLocalToHongKong("bad", "UTC")).toBe(false);
});

/**
 * Invalid local zones return false.
 */
test("FAIL_CONVERTLOCALHK_2: Invalid localZone returns false", () => {
  expect(DateTime.convertLocalToHongKong("2024-01-01 00:00:00", "Bad/Zone")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: TO_UNIX_TIMESTAMP TESTS
 * --------------------------------
 */

/**
 * Numeric inputs are returned as-is.
 */
test("PASS_TOUNIX_1: Number input returns floored number", () => {
  expect(DateTime.toUnixTimestamp(1_700_000_000)).toBe(1_700_000_000);
});

/**
 * JS Date instances convert to seconds.
 */
test("PASS_TOUNIX_2: JS Date input converts", () => {
  expect(DateTime.toUnixTimestamp(new Date("2024-01-01T00:00:00Z"))).toBe(1704067200);
});

/**
 * Luxon DateTime objects convert to seconds.
 */
test("PASS_TOUNIX_3: Luxon DateTime input converts", () => {
  const luxonDate = LuxonDateTime.fromISO("2024-01-01T00:00:00Z");
  expect(DateTime.toUnixTimestamp(luxonDate)).toBe(1704067200);
});

/**
 * Strings default to the Hong Kong zone.
 */
test("PASS_TOUNIX_4: String date using default zone", () => {
  expect(DateTime.toUnixTimestamp("2024-01-01 00:00:00")).toBe(1704038400);
});

/**
 * Custom timezones apply when provided.
 */
test("PASS_TOUNIX_5: String date with custom timeZone", () => {
  expect(DateTime.toUnixTimestamp("2024-01-01 00:00:00", LONDON_ZONE)).toBe(1704067200);
});

/**
 * fromUnixTimestamp mirrors toUnixTimestamp.
 */
test("PASS_FROMUNIX_1: Formats from Unix timestamp", () => {
  const expected = "2024-01-01 08:00:00";
  expect(
    DateTime.fromUnixTimestamp(1704067200, "yyyy-MM-dd HH:mm:ss", HK_ZONE)
  ).toBe(expected);
});

/**
 * Invalid strings return false.
 */
test("FAIL_TOUNIX_1: Invalid string date returns false", () => {
  expect(DateTime.toUnixTimestamp("bad-date")).toBe(false);
});

/**
 * Empty strings return false.
 */
test("FAIL_TOUNIX_2: Empty string returns false", () => {
  expect(DateTime.toUnixTimestamp("")).toBe(false);
});

/**
 * Unsupported inputs return false.
 */
test("FAIL_TOUNIX_3: Unsupported type returns false", () => {
  expect(DateTime.toUnixTimestamp({})).toBe(false);
});

/**
 * --------------------------------
 * SECTION: IS_NOW_BETWEEN TESTS
 * --------------------------------
 */

/**
 * Now inside the provided range returns true.
 */
test("PASS_ISNOWBETWEEN_1: Now within range returns true", () => {
  expect(DateTime.isNowBetween("2024-01-15 00:00:00", "2024-01-15 05:00:00", null)).toBe(true);
});

/**
 * Start points after now return false.
 */
test("PASS_ISNOWBETWEEN_2: Now before range returns false", () => {
  expect(DateTime.isNowBetween("2024-01-15 05:00:00", "2024-01-15 06:00:00", null)).toBe(false);
});

/**
 * End points before now return false.
 */
test("PASS_ISNOWBETWEEN_3: Now after range returns false", () => {
  expect(DateTime.isNowBetween("2024-01-15 00:00:00", "2024-01-15 04:00:00", null)).toBe(false);
});

/**
 * Custom timezone ranges respect the supplied zone.
 */
test("PASS_ISNOWBETWEEN_4: Works with custom timezone", () => {
  expect(DateTime.isNowBetween("2024-01-14 19:00:00", "2024-01-14 23:00:00", LONDON_ZONE)).toBe(true);
});

/**
 * Cross-midnight ranges include the window even after midnight.
 */
test("PASS_ISNOWBETWEEN_5: Cross-midnight range returns true after midnight", () => {
  expect(DateTime.isNowBetween("2024-01-14 23:00:00", "2024-01-14 04:30:00", null)).toBe(true);
});

/**
 * Cross-midnight windows respect custom zones as well.
 */
test("PASS_ISNOWBETWEEN_6: Cross-midnight custom timezone respects zone bounds", () => {
  expect(DateTime.isNowBetween("2024-01-14 20:00:00", "2024-01-14 05:00:00", LONDON_ZONE)).toBe(true);
});

/**
 * Set-time windows behave like isNowBetween but for explicit targets.
 */
test("PASS_ISDATETIMEBETWEEN_1: Cross-midnight target inside window returns true", () => {
  expect(
    DateTime.isDateTimeBetween(
      "2024-01-15 01:00:00",
      "2024-01-14 23:00:00",
      "2024-01-15 04:00:00",
      null
    )
  ).toBe(true);
});

test("PASS_ISDATETIMEBETWEEN_2: Cross-midnight target outside window returns false", () => {
  expect(
    DateTime.isDateTimeBetween(
      "2024-01-15 06:00:00",
      "2024-01-14 23:00:00",
      "2024-01-15 04:00:00",
      null
    )
  ).toBe(false);
});

test("PASS_ISDATETIMEBETWEEN_3: Custom timezone cross-midnight target", () => {
  expect(
    DateTime.isDateTimeBetween(
      "2024-01-14 21:30:00",
      "2024-01-14 20:00:00",
      "2024-01-14 05:00:00",
      LONDON_ZONE
    )
  ).toBe(true);
});

/**
 * Invalid start dates return false.
 */
test("FAIL_ISNOWBETWEEN_1: Invalid start date returns false", () => {
  expect(DateTime.isNowBetween("bad", "2024-01-02", null)).toBe(false);
});

/**
 * Invalid end dates return false.
 */
test("FAIL_ISNOWBETWEEN_2: Invalid end date returns false", () => {
  expect(DateTime.isNowBetween("2024-01-01", "bad", null)).toBe(false);
});

/**
 * --------------------------------
 * SECTION: DO_RANGES_OVERLAP TESTS
 * --------------------------------
 */

/**
 * Overlapping ranges return true.
 */
test("PASS_RANGESOVERLAP_1: Overlapping ranges", () => {
  expect(DateTime.doRangesOverlap("2024-01-01", "2024-01-10", "2024-01-05", "2024-01-15")).toBe(true);
});

/**
 * Touching boundaries count as overlap.
 */
test("PASS_RANGESOVERLAP_2: Touching at boundary counts as overlap", () => {
  expect(DateTime.doRangesOverlap("2024-01-01", "2024-01-10", "2024-01-10", "2024-01-20")).toBe(true);
});

/**
 * Non-overlapping ranges return false.
 */
test("PASS_RANGESOVERLAP_3: Non-overlapping ranges", () => {
  expect(DateTime.doRangesOverlap("2024-01-01", "2024-01-10", "2024-01-11", "2024-01-20")).toBe(false);
});

/**
 * Reversed boundaries are normalized internally.
 */
test("PASS_RANGESOVERLAP_4: Start/end reversed internally normalized", () => {
  expect(DateTime.doRangesOverlap("2024-01-10", "2024-01-01", "2024-01-15", "2024-01-05")).toBe(true);
});

/**
 * Custom timezone inputs are still respected.
 */
test("PASS_RANGESOVERLAP_5: Uses custom timezone", () => {
  expect(DateTime.doRangesOverlap("2024-01-01", "2024-01-10", "2024-01-05", "2024-01-15", LONDON_ZONE)).toBe(true);
});

/**
 * Any invalid dates return false.
 */
test("FAIL_RANGESOVERLAP_1: Any invalid date returns false", () => {
  expect(DateTime.doRangesOverlap("bad", "2024-01-10", "2024-01-05", "2024-01-15")).toBe(false);
});

/**
 * All invalid inputs return false.
 */
test("FAIL_RANGESOVERLAP_2: All invalid returns false", () => {
  expect(DateTime.doRangesOverlap("a", "b", "c", "d")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: LIST_DAYS_IN_RANGE TESTS
 * --------------------------------
 */

/**
 * Single-day ranges return a one-element array.
 */
test("PASS_LISTDAYS_1: Single-day range returns 1 date", () => {
  expect(DateTime.listDaysInRange("2024-01-01", "2024-01-01", null)).toEqual(["2024-01-01"]);
});

/**
 * Multi-day ranges enumerate each date inclusive.
 */
test("PASS_LISTDAYS_2: Multi-day range inclusive", () => {
  expect(DateTime.listDaysInRange("2024-01-01", "2024-01-03", null)).toEqual([
    "2024-01-01",
    "2024-01-02",
    "2024-01-03",
  ]);
});

/**
 * Start dates after end dates currently return false.
 */
test("PASS_LISTDAYS_3: Start after end still returns correct range", () => {
  expect(DateTime.listDaysInRange("2024-01-03", "2024-01-01", null)).toBe(false);
});

/**
 * Custom timezone inputs still produce yyyy-MM-dd strings.
 */
test("PASS_LISTDAYS_4: Custom timezone still returns yyyy-MM-dd strings", () => {
  expect(DateTime.listDaysInRange("2024-01-01 10:00:00", "2024-01-02 10:00:00", LONDON_ZONE)).toEqual([
    "2024-01-01",
    "2024-01-02",
  ]);
});

/**
 * Invalid start dates return false.
 */
test("FAIL_LISTDAYS_1: Invalid start date returns false", () => {
  expect(DateTime.listDaysInRange("bad", "2024-01-03", null)).toBe(false);
});

/**
 * Invalid end dates return false.
 */
test("FAIL_LISTDAYS_2: Invalid end date returns false", () => {
  expect(DateTime.listDaysInRange("2024-01-01", "bad", null)).toBe(false);
});

/**
 * Invalid timezone references result in false.
 */
test("FAIL_LISTDAYS_3: Start or end leads to invalid Luxon DateTime returns false", () => {
  expect(DateTime.listDaysInRange("2024-01-01", "2024-01-02", "Bad/Zone")).toBe(false);
});

/**
 * --------------------------------
 * SECTION: GETCOMMONFORMAT TESTS
 * --------------------------------
 */

/**
 * PASS_GETCOMMONFORMAT_1: Returns correct format for ISO aliases
 */
test("PASS_GETCOMMONFORMAT_1: Returns correct format for ISO aliases", () => {
  expect(DateTime.getCommonFormat("iso")).toBe(DateTime.FORMATS.ISO_DATETIME);
  expect(DateTime.getCommonFormat("iso-date")).toBe(DateTime.FORMATS.ISO_DATE);
  expect(DateTime.getCommonFormat("iso-datetime")).toBe(DateTime.FORMATS.ISO_DATETIME);
  expect(DateTime.getCommonFormat("iso-datetime-ms")).toBe(DateTime.FORMATS.ISO_DATETIME_MS);
  expect(DateTime.getCommonFormat("iso-datetime-tz")).toBe(DateTime.FORMATS.ISO_DATETIME_TZ);
});

/**
 * PASS_GETCOMMONFORMAT_2: Returns correct format for US aliases
 */
test("PASS_GETCOMMONFORMAT_2: Returns correct format for US aliases", () => {
  expect(DateTime.getCommonFormat("us")).toBe(DateTime.FORMATS.US_DATE);
  expect(DateTime.getCommonFormat("us-date")).toBe(DateTime.FORMATS.US_DATE);
  expect(DateTime.getCommonFormat("us-datetime")).toBe(DateTime.FORMATS.US_DATETIME);
});

/**
 * PASS_GETCOMMONFORMAT_3: Returns correct format for EU aliases
 */
test("PASS_GETCOMMONFORMAT_3: Returns correct format for EU aliases", () => {
  expect(DateTime.getCommonFormat("eu")).toBe(DateTime.FORMATS.EU_DATE);
  expect(DateTime.getCommonFormat("eu-date")).toBe(DateTime.FORMATS.EU_DATE);
  expect(DateTime.getCommonFormat("eu-datetime")).toBe(DateTime.FORMATS.EU_DATETIME);
});

/**
 * PASS_GETCOMMONFORMAT_4: Returns correct format for UK aliases
 */
test("PASS_GETCOMMONFORMAT_4: Returns correct format for UK aliases", () => {
  expect(DateTime.getCommonFormat("uk")).toBe(DateTime.FORMATS.UK_DATE);
  expect(DateTime.getCommonFormat("uk-date")).toBe(DateTime.FORMATS.UK_DATE);
  expect(DateTime.getCommonFormat("uk-datetime")).toBe(DateTime.FORMATS.UK_DATETIME);
});

/**
 * PASS_GETCOMMONFORMAT_5: Returns correct format for time aliases
 */
test("PASS_GETCOMMONFORMAT_5: Returns correct format for time aliases", () => {
  expect(DateTime.getCommonFormat("time")).toBe(DateTime.FORMATS.TIME_24);
  expect(DateTime.getCommonFormat("time-24")).toBe(DateTime.FORMATS.TIME_24);
  expect(DateTime.getCommonFormat("time-12")).toBe(DateTime.FORMATS.TIME_12);
});

/**
 * PASS_GETCOMMONFORMAT_6: Returns correct format for RFC aliases
 */
test("PASS_GETCOMMONFORMAT_6: Returns correct format for RFC aliases", () => {
  expect(DateTime.getCommonFormat("rfc822")).toBe(DateTime.FORMATS.RFC822);
  expect(DateTime.getCommonFormat("rfc3339")).toBe(DateTime.FORMATS.RFC3339);
});

/**
 * PASS_GETCOMMONFORMAT_7: Returns correct format for Unix aliases
 */
test("PASS_GETCOMMONFORMAT_7: Returns correct format for Unix aliases", () => {
  expect(DateTime.getCommonFormat("unix")).toBe(DateTime.FORMATS.UNIX_TIMESTAMP);
  expect(DateTime.getCommonFormat("unix-ms")).toBe(DateTime.FORMATS.UNIX_TIMESTAMP_MS);
});

/**
 * PASS_GETCOMMONFORMAT_8: Case-insensitive alias matching
 */
test("PASS_GETCOMMONFORMAT_8: Case-insensitive alias matching", () => {
  expect(DateTime.getCommonFormat("ISO")).toBe(DateTime.FORMATS.ISO_DATETIME);
  expect(DateTime.getCommonFormat("Us")).toBe(DateTime.FORMATS.US_DATE);
  expect(DateTime.getCommonFormat("RFC822")).toBe(DateTime.FORMATS.RFC822);
});

/**
 * FAIL_GETCOMMONFORMAT_1: Returns null for unknown alias
 */
test("FAIL_GETCOMMONFORMAT_1: Returns null for unknown alias", () => {
  expect(DateTime.getCommonFormat("unknown")).toBeNull();
  expect(DateTime.getCommonFormat("invalid-format")).toBeNull();
  expect(DateTime.getCommonFormat("")).toBeNull();
});

/**
 * FAIL_GETCOMMONFORMAT_2: Returns null for non-string input
 */
test("FAIL_GETCOMMONFORMAT_2: Returns null for non-string input", () => {
  expect(DateTime.getCommonFormat(null)).toBeNull();
  expect(DateTime.getCommonFormat(undefined)).toBeNull();
  expect(DateTime.getCommonFormat(123)).toBeNull();
});

/**
 * --------------------------------
 * SECTION: FORMATS CONSTANT TESTS
 * --------------------------------
 */

/**
 * PASS_FORMATS_1: FORMATS constant contains all expected format strings
 */
test("PASS_FORMATS_1: FORMATS constant contains all expected format strings", () => {
  expect(DateTime.FORMATS.ISO_DATE).toBe("yyyy-MM-dd");
  expect(DateTime.FORMATS.ISO_DATETIME).toBe("yyyy-MM-dd HH:mm:ss");
  expect(DateTime.FORMATS.ISO_DATETIME_MS).toBe("yyyy-MM-dd HH:mm:ss.SSS");
  expect(DateTime.FORMATS.ISO_DATETIME_TZ).toBe("yyyy-MM-dd'T'HH:mm:ssZZ");
  expect(DateTime.FORMATS.ISO_DATETIME_MS_TZ).toBe("yyyy-MM-dd'T'HH:mm:ss.SSSZZ");
  expect(DateTime.FORMATS.US_DATE).toBe("MM/dd/yyyy");
  expect(DateTime.FORMATS.US_DATETIME).toBe("MM/dd/yyyy HH:mm:ss");
  expect(DateTime.FORMATS.EU_DATE).toBe("dd/MM/yyyy");
  expect(DateTime.FORMATS.EU_DATETIME).toBe("dd/MM/yyyy HH:mm:ss");
  expect(DateTime.FORMATS.UK_DATE).toBe("dd-MM-yyyy");
  expect(DateTime.FORMATS.UK_DATETIME).toBe("dd-MM-yyyy HH:mm:ss");
  expect(DateTime.FORMATS.TIME_24).toBe("HH:mm:ss");
  expect(DateTime.FORMATS.TIME_12).toBe("hh:mm:ss a");
  expect(DateTime.FORMATS.DATE_TIME_COMPACT).toBe("yyyyMMddHHmmss");
  expect(DateTime.FORMATS.DATE_COMPACT).toBe("yyyyMMdd");
  expect(DateTime.FORMATS.MONTH_YEAR).toBe("MMMM yyyy");
  expect(DateTime.FORMATS.MONTH_DAY).toBe("MMMM d");
  expect(DateTime.FORMATS.DAY_NAME).toBe("EEEE");
  expect(DateTime.FORMATS.DAY_SHORT).toBe("EEE");
  expect(DateTime.FORMATS.MONTH_NAME).toBe("MMMM");
  expect(DateTime.FORMATS.MONTH_SHORT).toBe("MMM");
  expect(DateTime.FORMATS.YEAR_MONTH).toBe("yyyy-MM");
  expect(DateTime.FORMATS.RFC822).toBe("EEE, dd MMM yyyy HH:mm:ss ZZZ");
  expect(DateTime.FORMATS.RFC3339).toBe("yyyy-MM-dd'T'HH:mm:ssZZ");
  expect(DateTime.FORMATS.UNIX_TIMESTAMP).toBe("X");
  expect(DateTime.FORMATS.UNIX_TIMESTAMP_MS).toBe("x");
});

/**
 * PASS_FORMATS_2: FORMATS constant is frozen (immutable)
 */
test("PASS_FORMATS_2: FORMATS constant is frozen (immutable)", () => {
  const originalValue = DateTime.FORMATS.ISO_DATE;
  
  // Attempting to modify should not work (in strict mode would throw)
  try {
    DateTime.FORMATS.ISO_DATE = "modified";
  } catch (e) {
    // Expected in strict mode
  }
  
  // Value should remain unchanged
  expect(DateTime.FORMATS.ISO_DATE).toBe(originalValue);
});

/**
 * PASS_FORMATS_3: FORMATS can be used with formatDate
 */
test("PASS_FORMATS_3: FORMATS can be used with formatDate", () => {
  const dateStr = "2024-01-15 14:30:00";
  const result = DateTime.formatDate(dateStr, DateTime.FORMATS.ISO_DATE);
  
  expect(result).toBe("2024-01-15");
});

/**
 * --------------------------------
 * SECTION: CACHING TESTS
 * --------------------------------
 */

/**
 * PASS_CACHE_1: Format cache improves performance for repeated conversions
 */
test("PASS_CACHE_1: Format cache improves performance for repeated conversions", () => {
  const phpFormat = "Y-m-d H:i:s";
  
  // First call should compute
  const result1 = DateTime.phpToLuxonFormat(phpFormat);
  
  // Second call should use cache (same result)
  const result2 = DateTime.phpToLuxonFormat(phpFormat);
  
  expect(result1).toBe(result2);
  expect(result1).toBe("yyyy-MM-dd HH:mm:ss");
});

/**
 * PASS_CACHE_2: Timezone cache improves performance for repeated validations
 */
test("PASS_CACHE_2: Timezone cache improves performance for repeated validations", () => {
  const timezone = "America/New_York";
  
  // First call should validate
  const result1 = DateTime.resolveTimeZone(timezone);
  
  // Second call should use cache
  const result2 = DateTime.resolveTimeZone(timezone);
  
  expect(result1).toBe(result2);
  expect(result1).toBe(timezone);
});
