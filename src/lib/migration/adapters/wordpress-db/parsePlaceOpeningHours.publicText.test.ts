import assert from "node:assert/strict";

import { buildPublicWorkingHoursText } from "@/server/services/openingHours/openingHours.publicSummary";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import type { OpeningHoursData } from "@/components/openingHours/openingHours.types";

import { parsePlaceOpeningHours } from "./parsePlaceOpeningHours";

/**
 * Reconstructs the shape a real DB round-trip would return
 * (`prisma.openingHours.create({data: mapToCreatePayload(data), include: {rules: {include: {intervals: true}}, ...}})`)
 * from the parser's `OpeningHoursData` output — id/sortOrder/createdAt/
 * updatedAt are fake since the real DB assigns them, but every field the
 * public/admin consumers actually read (`mode`, `timezone`, `note`,
 * `rules[].dayOfWeek/isOpen/allDay/intervals[].startTime/endTime`) comes
 * straight from the parser, unmodified — this is the same "one canonical
 * shape flows through unchanged" property the writer relies on when it
 * hands `data` to `mapToCreatePayload` verbatim.
 */
function toWithRelations(data: OpeningHoursData): OpeningHoursWithRelations {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "opening-hours-1",
    mode: data.mode,
    timezone: data.timezone,
    note: data.note ?? null,
    createdAt: now,
    updatedAt: now,
    rules: data.rules
      .filter((rule) => rule.isOpen)
      .map((rule, ruleIndex) => ({
        id: `rule-${ruleIndex}`,
        openingHoursId: "opening-hours-1",
        dayOfWeek: rule.dayOfWeek,
        isOpen: rule.isOpen,
        allDay: rule.allDay,
        intervals: rule.intervals.map((interval, intervalIndex) => ({
          id: `interval-${ruleIndex}-${intervalIndex}`,
          ruleId: `rule-${ruleIndex}`,
          startTime: interval.startTime,
          endTime: interval.endTime,
          sortOrder: intervalIndex,
        })),
      })),
    exceptions: [],
  } as unknown as OpeningHoursWithRelations;
}

/** A fixed "now" outside every sample's actual hours, so `status.message` is deterministic across runs regardless of when tests execute. */
const FIXED_NOW = new Date("2026-01-05T03:00:00.000Z"); // Monday 03:00 Europe/Minsk-ish UTC

function renderFromRawWorkHours(workHoursRaw: string): { text: string; data: OpeningHoursData | null } {
  const parsed = parsePlaceOpeningHours(workHoursRaw);
  if (!parsed.data) return { text: "", data: null };
  return { text: buildPublicWorkingHoursText(toWithRelations(parsed.data), FIXED_NOW), data: parsed.data };
}

function testGoldenWp5389RendersDailyHoursForEveryDay() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"11:00","to":"22:00"}]}]`;
  const { text } = renderFromRawWorkHours(raw);
  assert.ok(text.includes("Пн: 11:00–22:00"));
  assert.ok(text.includes("Вс: 11:00–22:00"));
}

function testGoldenWp5457RendersDifferentWeekdayVsWeekendHours() {
  const raw = `[{"days":["mon","tue","wed","thu","fri"],"status":"hours","hours":[{"from":"09:00","to":"21:00"}]},{"days":["sat","sun"],"status":"hours","hours":[{"from":"10:00","to":"21:00"}]}]`;
  const { text } = renderFromRawWorkHours(raw);
  assert.ok(text.includes("Пн: 09:00–21:00"));
  assert.ok(text.includes("Сб: 10:00–21:00"));
}

function testGoldenWp13164RendersByAppointmentMessage() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"appointments_only","hours":[]}]`;
  const { text } = renderFromRawWorkHours(raw);
  assert.equal(text, "По записи");
}

function testGoldenWp13317RendersEveryDayAsDayOff() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"closed","hours":[]}]`;
  const { text } = renderFromRawWorkHours(raw);
  // `mapToCreatePayload` filters to `rule.isOpen` only, so an all-closed
  // WEEKLY schedule ends up with zero real `OpeningHoursRule` rows in the
  // DB — `buildPublicWorkingHoursText`'s `!rules?.length` guard then
  // short-circuits to the bare status message, never a day-by-day list.
  assert.equal(text, "Сейчас закрыто");
  assert.ok(!text.includes("Временно закрыто"), "must never claim a specific temporarily-closed business status the source never asserted");
}

function testGoldenWp9865RendersOddMinuteEndTime() {
  const raw = `[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"09:00","to":"22:20"}]}]`;
  const { text } = renderFromRawWorkHours(raw);
  assert.ok(text.includes("Пн: 09:00–22:20"));
}

function testWp30411UnsupportedOpenProducesNoOpeningHoursRowAtAll() {
  const raw = `[{"days":["mon","tue","thu","wed","fri","sat","sun"],"status":"open","hours":[]}]`;
  const { data } = renderFromRawWorkHours(raw);
  // No OpeningHours row is ever created for this place — matches the real
  // public page's behavior for `place.openingHoursId === null`: the
  // working-hours section is simply omitted, never a fabricated "Круглосуточно".
  assert.equal(data, null);
}

function testWp30502MixedClosedMondayRendersBothStates() {
  const raw = `[{"days":["tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"10:00","to":"17:00"}]},{"days":["mon"],"status":"closed","hours":[]}]`;
  const { text } = renderFromRawWorkHours(raw);
  assert.ok(text.includes("Пн: выходной"));
  assert.ok(text.includes("Вт: 10:00–17:00"));
}

function testMultipleIntervalsRenderAsCommaSeparatedList() {
  const raw = `[{"days":["mon"],"status":"hours","hours":[{"from":"10:00","to":"13:15"},{"from":"14:15","to":"19:00"}]}]`;
  const { text } = renderFromRawWorkHours(raw);
  assert.ok(text.includes("Пн: 10:00–13:15, 14:15–19:00"));
}

function main() {
  testGoldenWp5389RendersDailyHoursForEveryDay();
  testGoldenWp5457RendersDifferentWeekdayVsWeekendHours();
  testGoldenWp13164RendersByAppointmentMessage();
  testGoldenWp13317RendersEveryDayAsDayOff();
  testGoldenWp9865RendersOddMinuteEndTime();
  testWp30411UnsupportedOpenProducesNoOpeningHoursRowAtAll();
  testWp30502MixedClosedMondayRendersBothStates();
  testMultipleIntervalsRenderAsCommaSeparatedList();
  console.log("parsePlaceOpeningHours.publicText tests: OK");
}

main();
