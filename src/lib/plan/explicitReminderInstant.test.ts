import assert from "node:assert/strict";
import { parseExplicitReminderInstant } from "./explicitReminderInstant";

assert.equal(parseExplicitReminderInstant("2026-10-29T15:30:00+03:00")?.toISOString(), "2026-10-29T12:30:00.000Z");
assert.equal(parseExplicitReminderInstant(null), null);
assert.equal(parseExplicitReminderInstant(""), null);
for (const bad of ["2026-10-29T15:30", "2026-13-30T10:00:00Z", "not-a-date", 7]) {
  assert.throws(() => parseExplicitReminderInstant(bad));
}
