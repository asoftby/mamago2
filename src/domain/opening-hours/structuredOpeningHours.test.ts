import assert from "node:assert/strict";
import test from "node:test";
import { SharedOpeningHoursDataSchema, openingHoursFromRelational } from "./structuredOpeningHours";
import { getOpeningStatus } from "@/server/services/openingHours/openingHours.service";

const source = {
  mode: "WEEKLY" as const,
  timezone: "Europe/Minsk",
  note: "  Вход со двора ",
  rules: [
    { dayOfWeek: "TUE" as const, isOpen: true, allDay: true, intervals: [] },
    {
      dayOfWeek: "MON" as const,
      isOpen: true,
      allDay: false,
      intervals: [
        { startTime: "14:00", endTime: "18:00", sortOrder: 1 },
        { startTime: "09:00", endTime: "13:00", sortOrder: 0 },
      ],
    },
    { dayOfWeek: "WED" as const, isOpen: false, allDay: false, intervals: [] },
  ],
  exceptions: [
    { date: "2026-09-02", isClosed: false, allDay: true, intervals: [], note: null },
    { date: "2026-09-01", isClosed: true, allDay: false, intervals: [], note: " праздник " },
  ],
};

test("adapts relational rules, closed/all-day states, intervals and exceptions deterministically", () => {
  const value = openingHoursFromRelational(source);
  assert.deepEqual(value.rules.map((rule) => rule.dayOfWeek), ["MON", "TUE", "WED"]);
  assert.deepEqual(value.rules[0].intervals.map((item) => item.startTime), ["09:00", "14:00"]);
  assert.equal(value.rules[1].allDay, true);
  assert.equal(value.rules[2].isOpen, false);
  assert.deepEqual(value.exceptions.map((item) => item.date), ["2026-09-01", "2026-09-02"]);
  assert.equal(value.exceptions[0].isClosed, true);
  assert.equal(value.exceptions[0].note, "праздник");
});

test("feeds the existing open-now path without a Prisma-shaped snapshot", () => {
  const value = openingHoursFromRelational(source);
  const status = getOpeningStatus(value, new Date("2026-08-31T07:30:00.000Z"));
  assert.equal(status.isOpen, true);
  assert.equal(status.message, "Открыто до 13:00");
});

test("accepts runtime-supported timezones and rejects invalid identifiers", () => {
  for (const timezone of ["Europe/Minsk", "UTC"]) {
    const value = openingHoursFromRelational({ ...source, timezone });
    assert.doesNotThrow(() => getOpeningStatus(value, new Date("2026-08-31T07:30:00.000Z")));
  }
  assert.throws(() => openingHoursFromRelational({ ...source, timezone: "not/a-zone" }));
});

test("validates real calendar exception dates including leap years", () => {
  const withDate = (date: string) => openingHoursFromRelational({
    ...source,
    exceptions: [{ date, isClosed: true, allDay: false, intervals: [], note: null }],
  });
  assert.doesNotThrow(() => withDate("2026-02-28"));
  assert.throws(() => withDate("2026-02-29"));
  assert.doesNotThrow(() => withDate("2028-02-29"));
  assert.throws(() => withDate("2026-02-31"));
  assert.throws(() => withDate("2026-13-01"));
});

test("survives JSON serialization", () => {
  const value = openingHoursFromRelational(source);
  assert.deepEqual(SharedOpeningHoursDataSchema.parse(JSON.parse(JSON.stringify(value))), value);
});

test("rejects malformed times and unsupported overnight ranges", () => {
  const value = openingHoursFromRelational(source);
  assert.throws(() => SharedOpeningHoursDataSchema.parse({
    ...value,
    rules: [{ dayOfWeek: "FRI", isOpen: true, allDay: false, intervals: [{ startTime: "20:00", endTime: "02:00" }] }],
  }));
  assert.throws(() => SharedOpeningHoursDataSchema.parse({
    ...value,
    rules: [{ dayOfWeek: "FRI", isOpen: true, allDay: false, intervals: [{ startTime: "9:00", endTime: "18:00" }] }],
  }));
});
