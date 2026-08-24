import assert from "node:assert/strict";
import test from "node:test";
import { dateRangeReducer, emptyDateRangeDraft } from "./dateRangeReducer";

const today = "2026-08-24";
const tap = (state: typeof emptyDateRangeDraft, date: string) =>
  dateRangeReducer(state, { type: "select", date, today });

test("first tap is a valid single-day range", () => {
  assert.deepEqual(tap(emptyDateRangeDraft, today), { from: today, to: today, selectingEnd: true });
});
test("second later tap completes a range across month/year boundaries", () => {
  assert.deepEqual(tap(tap(emptyDateRangeDraft, "2026-12-31"), "2027-01-02"), { from: "2026-12-31", to: "2027-01-02", selectingEnd: false });
});
test("second earlier tap starts a new range", () => {
  assert.deepEqual(tap(tap(emptyDateRangeDraft, "2026-09-02"), "2026-08-30"), { from: "2026-08-30", to: "2026-08-30", selectingEnd: true });
});
test("same-day second tap completes the single-day range", () => {
  assert.deepEqual(tap(tap(emptyDateRangeDraft, today), today), { from: today, to: today, selectingEnd: false });
});
test("past dates are ignored", () => assert.deepEqual(tap(emptyDateRangeDraft, "2026-08-23"), emptyDateRangeDraft));
test("reset clears a selected range back to the empty draft", () => {
  const selected = tap(tap(emptyDateRangeDraft, today), "2026-08-27");
  assert.deepEqual(dateRangeReducer(selected, { type: "reset" }), emptyDateRangeDraft);
});
test("reset on an already-empty draft is a no-op", () => {
  assert.deepEqual(dateRangeReducer(emptyDateRangeDraft, { type: "reset" }), emptyDateRangeDraft);
});
