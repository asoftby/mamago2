import assert from "node:assert/strict";

import { parsePlaceOpeningHours } from "./parsePlaceOpeningHours";

function warningCodes(result: ReturnType<typeof parsePlaceOpeningHours>): string[] {
  return result.warnings.map((w) => w.code);
}

function ruleFor(data: ReturnType<typeof parsePlaceOpeningHours>["data"], day: string) {
  return data?.rules.find((r) => r.dayOfWeek === day);
}

// ---------------------------------------------------------------------------
// Golden fixtures — real WordPress work_hours values, confirmed 2026-07-15
// via a read-only SELECT against the remote WP DB (--allow-remote-readonly).
// ---------------------------------------------------------------------------

function testGoldenWp5389StandardAllWeek() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"11:00","to":"22:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);

  assert.equal(result.data?.mode, "WEEKLY");
  assert.equal(result.data?.rules.length, 7);
  for (const day of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) {
    const rule = ruleFor(result.data, day);
    assert.equal(rule?.isOpen, true);
    assert.deepEqual(rule?.intervals, [{ startTime: "11:00", endTime: "22:00" }]);
  }
  assert.deepEqual(result.warnings, []);
}

function testGoldenWp5457WeekdayWeekendGroups() {
  const raw = `[{"days":["mon","tue","wed","thu","fri"],"status":"hours","hours":[{"from":"09:00","to":"21:00"}]},{"days":["sat","sun"],"status":"hours","hours":[{"from":"10:00","to":"21:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);

  assert.equal(ruleFor(result.data, "MON")?.intervals[0].startTime, "09:00");
  assert.equal(ruleFor(result.data, "SAT")?.intervals[0].startTime, "10:00");
  assert.deepEqual(result.warnings, []);
}

function testGoldenWp13164AppointmentsOnly() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"appointments_only","hours":[]}]`;
  const result = parsePlaceOpeningHours(raw);

  assert.equal(result.data?.mode, "BY_APPOINTMENT");
  assert.deepEqual(result.warnings, []);
}

function testGoldenWp13317ClosedAllWeek() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"closed","hours":[]}]`;
  const result = parsePlaceOpeningHours(raw);

  // WEEKLY with 7 closed days — never TEMPORARILY_CLOSED (see parser docblock).
  assert.equal(result.data?.mode, "WEEKLY");
  assert.equal(result.data?.rules.length, 7);
  assert.ok(result.data?.rules.every((r) => !r.isOpen));
  assert.deepEqual(result.warnings, []);
}

function testGoldenWp9865StandardAllWeekWithOddMinutes() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"09:00","to":"22:20"}]}]`;
  const result = parsePlaceOpeningHours(raw);

  assert.equal(ruleFor(result.data, "MON")?.intervals[0].endTime, "22:20");
  assert.deepEqual(result.warnings, []);
}

// ---------------------------------------------------------------------------
// Standard shapes.
// ---------------------------------------------------------------------------

function testSingleGroupAllWeekdaysAndWeekend() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"10:00","to":"20:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);
  assert.equal(result.data?.rules.length, 7);
  assert.ok(result.data?.rules.every((r) => r.isOpen));
}

function testMultipleDayGroups() {
  const raw = `[{"days":["mon"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]},{"days":["tue","wed"],"status":"hours","hours":[{"from":"10:00","to":"19:00"}]},{"days":["fri"],"status":"closed","hours":[]},{"days":["sat","sun"],"status":"appointments_only","hours":[]}]`;
  const result = parsePlaceOpeningHours(raw);

  // Mixed statuses across groups can never collapse to BY_APPOINTMENT
  // (appointmentDayCount=2, not 7) — falls back to WEEKLY, appointment days
  // dropped with a warning.
  assert.equal(result.data?.mode, "WEEKLY");
  assert.equal(ruleFor(result.data, "MON")?.intervals[0].startTime, "09:00");
  assert.equal(ruleFor(result.data, "FRI")?.isOpen, false);
  assert.equal(ruleFor(result.data, "SAT")?.isOpen, false, "appointment day without full-week coverage stays closed");
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_UNSUPPORTED"));
}

function testMultipleIntervalsInOneDay() {
  const raw = `[{"days":["mon"],"status":"hours","hours":[{"from":"10:00","to":"13:15"},{"from":"14:15","to":"19:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);
  const mon = ruleFor(result.data, "MON");
  assert.equal(mon?.intervals.length, 2);
  assert.deepEqual(mon?.intervals[0], { startTime: "10:00", endTime: "13:15" });
  assert.deepEqual(mon?.intervals[1], { startTime: "14:15", endTime: "19:00" });
}

function testSameHoursForMultipleDaysCollapsedIntoOneGroup() {
  const raw = `[{"days":["mon","tue","wed"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);
  for (const day of ["MON", "TUE", "WED"]) {
    assert.deepEqual(ruleFor(result.data, day)?.intervals, [{ startTime: "09:00", endTime: "18:00" }]);
  }
  assert.equal(ruleFor(result.data, "THU")?.isOpen, false, "days outside any group default to closed");
}

// ---------------------------------------------------------------------------
// Statuses.
// ---------------------------------------------------------------------------

function testAppointmentsOnlyWholeWeek() {
  const result = parsePlaceOpeningHours(
    `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"appointments_only","hours":[]}]`,
  );
  assert.equal(result.data?.mode, "BY_APPOINTMENT");
}

function testClosedStatus() {
  const result = parsePlaceOpeningHours(`[{"days":["mon"],"status":"closed","hours":[]}]`);
  assert.equal(ruleFor(result.data, "MON")?.isOpen, false);
  assert.deepEqual(ruleFor(result.data, "MON")?.intervals, []);
}

function testOpenWithProvenHoursTreatedAsRealHours() {
  const result = parsePlaceOpeningHours(`[{"days":["mon"],"status":"open","hours":[{"from":"08:00","to":"22:00"}]}]`);
  assert.equal(ruleFor(result.data, "MON")?.isOpen, true);
  assert.deepEqual(ruleFor(result.data, "MON")?.intervals, [{ startTime: "08:00", endTime: "22:00" }]);
  assert.deepEqual(result.warnings, []);
}

function testOpenWithoutHoursNeverBecomesAlwaysOpen() {
  const result = parsePlaceOpeningHours(`[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"open","hours":[]}]`);
  assert.equal(result.data, null, "never fabricate 24/7 without evidence");
  assert.deepEqual(warningCodes(result), ["PLACE_WORK_HOURS_UNSUPPORTED"]);
}

// ---------------------------------------------------------------------------
// Missing / empty.
// ---------------------------------------------------------------------------

function testMissingWorkHoursRawIsNullNoWarning() {
  const result = parsePlaceOpeningHours(null);
  assert.equal(result.data, null);
  assert.deepEqual(result.warnings, [], "a legitimately absent optional field must never warn");
  assert.equal(result.rawEvidence, null);
}

function testWhitespaceOnlyTreatedAsMissing() {
  const result = parsePlaceOpeningHours("   ");
  assert.equal(result.data, null);
  assert.deepEqual(result.warnings, []);
}

function testEmptyArrayWarns() {
  const result = parsePlaceOpeningHours("[]");
  assert.equal(result.data, null);
  assert.deepEqual(warningCodes(result), ["PLACE_WORK_HOURS_EMPTY"]);
}

// ---------------------------------------------------------------------------
// Invalid / unsupported input.
// ---------------------------------------------------------------------------

function testInvalidJsonSyntax() {
  const result = parsePlaceOpeningHours("{not valid json");
  assert.equal(result.data, null);
  assert.deepEqual(warningCodes(result), ["PLACE_WORK_HOURS_JSON_INVALID"]);
  assert.equal(result.rawEvidence, "{not valid json");
}

function testValidJsonButNotAnArray() {
  const result = parsePlaceOpeningHours(`{"mon":"9-18"}`);
  assert.equal(result.data, null);
  assert.deepEqual(warningCodes(result), ["PLACE_WORK_HOURS_JSON_INVALID"]);
}

function testUnknownStatusValue() {
  const result = parsePlaceOpeningHours(`[{"days":["mon"],"status":"siesta","hours":[]}]`);
  assert.equal(ruleFor(result.data, "MON"), undefined);
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_STATUS_UNKNOWN"));
}

function testInvalidDayToken() {
  const result = parsePlaceOpeningHours(`[{"days":["mon","funday"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]}]`);
  assert.equal(ruleFor(result.data, "MON")?.isOpen, true);
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_DAY_INVALID"));
}

function testInvalidTimeString() {
  const result = parsePlaceOpeningHours(`[{"days":["mon"],"status":"hours","hours":[{"from":"9am","to":"6pm"}]}]`);
  assert.equal(result.data, null, "no usable interval survives anywhere in the source, nothing to write");
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_TIME_INVALID"));
}

function testInvalidTimeStringOnOneDayLeavesOthersIntact() {
  const raw = `[{"days":["mon"],"status":"hours","hours":[{"from":"9am","to":"6pm"}]},{"days":["tue"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);
  assert.equal(ruleFor(result.data, "MON")?.isOpen, false, "MON has no usable interval, so it defaults closed inside the WEEKLY result");
  assert.equal(ruleFor(result.data, "TUE")?.isOpen, true);
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_TIME_INVALID"));
}

function testInvalidTimeOutOfRange() {
  const result = parsePlaceOpeningHours(`[{"days":["mon"],"status":"hours","hours":[{"from":"25:00","to":"26:00"}]}]`);
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_TIME_INVALID"));
}

function testDuplicateDayAssignmentAcrossGroups() {
  const raw = `[{"days":["mon"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]},{"days":["mon"],"status":"hours","hours":[{"from":"10:00","to":"20:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);
  assert.deepEqual(ruleFor(result.data, "MON")?.intervals, [{ startTime: "09:00", endTime: "18:00" }], "first assignment wins");
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_INTERVAL_OVERLAP"));
}

// ---------------------------------------------------------------------------
// Overnight.
// ---------------------------------------------------------------------------

function testOvernightIntervalReportedUnsupportedNotStored() {
  const result = parsePlaceOpeningHours(`[{"days":["fri"],"status":"hours","hours":[{"from":"20:00","to":"02:00"}]}]`);
  assert.equal(result.data, null, "the only interval is overnight-unsupported, nothing usable remains");
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_UNSUPPORTED"));
}

function testZeroDurationIntervalTreatedAsOvernightUnsupported() {
  const result = parsePlaceOpeningHours(`[{"days":["mon"],"status":"hours","hours":[{"from":"10:00","to":"10:00"}]}]`);
  assert.equal(result.data, null);
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_UNSUPPORTED"));
}

function testOvernightAlongsideValidIntervalKeepsTheValidOne() {
  const raw = `[{"days":["mon"],"status":"hours","hours":[{"from":"09:00","to":"12:00"},{"from":"22:00","to":"02:00"}]}]`;
  const result = parsePlaceOpeningHours(raw);
  assert.deepEqual(ruleFor(result.data, "MON")?.intervals, [{ startTime: "09:00", endTime: "12:00" }]);
  assert.ok(warningCodes(result).includes("PLACE_WORK_HOURS_UNSUPPORTED"));
}

// ---------------------------------------------------------------------------
// Determinism.
// ---------------------------------------------------------------------------

function testDeterministicOutputAcrossRepeatedCalls() {
  const raw = `[{"days":["mon","tue","wed"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]},{"days":["thu","fri"],"status":"closed","hours":[]}]`;
  const first = parsePlaceOpeningHours(raw);
  const second = parsePlaceOpeningHours(raw);
  assert.deepEqual(first, second);
}

function main() {
  testGoldenWp5389StandardAllWeek();
  testGoldenWp5457WeekdayWeekendGroups();
  testGoldenWp13164AppointmentsOnly();
  testGoldenWp13317ClosedAllWeek();
  testGoldenWp9865StandardAllWeekWithOddMinutes();

  testSingleGroupAllWeekdaysAndWeekend();
  testMultipleDayGroups();
  testMultipleIntervalsInOneDay();
  testSameHoursForMultipleDaysCollapsedIntoOneGroup();

  testAppointmentsOnlyWholeWeek();
  testClosedStatus();
  testOpenWithProvenHoursTreatedAsRealHours();
  testOpenWithoutHoursNeverBecomesAlwaysOpen();

  testMissingWorkHoursRawIsNullNoWarning();
  testWhitespaceOnlyTreatedAsMissing();
  testEmptyArrayWarns();

  testInvalidJsonSyntax();
  testValidJsonButNotAnArray();
  testUnknownStatusValue();
  testInvalidDayToken();
  testInvalidTimeString();
  testInvalidTimeStringOnOneDayLeavesOthersIntact();
  testInvalidTimeOutOfRange();
  testDuplicateDayAssignmentAcrossGroups();

  testOvernightIntervalReportedUnsupportedNotStored();
  testZeroDurationIntervalTreatedAsOvernightUnsupported();
  testOvernightAlongsideValidIntervalKeepsTheValidOne();

  testDeterministicOutputAcrossRepeatedCalls();

  console.log("parsePlaceOpeningHours tests: OK");
}

main();
