import assert from "node:assert/strict";
import { extractScheduleOccurrences } from "./materializeScheduleSessions";
import {
  eventSessionFingerprintFromStoredSessions,
  eventSessionScheduleFingerprint,
} from "@/lib/business/syncEventActivitySessions";
import { normalizeSessionTitle, SESSION_TITLE_MAX_LENGTH } from "./sessionTitle";

{
  // "normalizeSessionTitle trims and maps empty to null"
  assert.equal(normalizeSessionTitle("  Коралина  "), "Коралина");
  assert.equal(normalizeSessionTitle(""), null);
  assert.equal(normalizeSessionTitle("   "), null);
  assert.equal(normalizeSessionTitle(undefined), null);
  assert.equal(normalizeSessionTitle(42), null);
}

{
  // "normalizeSessionTitle caps length at 120"
  const out = normalizeSessionTitle("а".repeat(300));
  assert.equal(out?.length, SESSION_TITLE_MAX_LENGTH);
}

{
  // "schedule item title flows into occurrences and recurrence copies it"
  const occurrences = extractScheduleOccurrences({
    scheduleItems: [
      { date: "2026-10-20", startTime: "12:00", title: " Коралина " },
      { date: "2026-10-21", startTime: "12:00", title: "  " },
      {
        date: "2026-10-27",
        startTime: "15:00",
        title: "Шрек",
        recurringEnabled: true,
        recurrenceInterval: 1,
        recurrenceUnit: "week",
        recurrenceUntil: "2026-11-03",
      },
    ],
  });
  assert.deepEqual(
    occurrences.map((o) => [o.date, o.title ?? null]),
    [
      ["2026-10-20", "Коралина"],
      ["2026-10-21", null],
      ["2026-10-27", "Шрек"],
      ["2026-11-03", "Шрек"],
    ],
  );
}

{
  // "fingerprint ignores absent title but detects title change"
  const plain = { scheduleItems: [{ date: "2026-10-20", startTime: "12:00" }] };
  const titled = { scheduleItems: [{ date: "2026-10-20", startTime: "12:00", title: "Коралина" }] };
  const stored = (title: string | null) => [{ startsAt: new Date("2026-10-20T09:00:00Z"), title }];
  assert.equal(eventSessionScheduleFingerprint(plain), eventSessionFingerprintFromStoredSessions(stored(null)));
  assert.equal(eventSessionScheduleFingerprint(titled), eventSessionFingerprintFromStoredSessions(stored("Коралина")));
  assert.notEqual(eventSessionScheduleFingerprint(titled), eventSessionFingerprintFromStoredSessions(stored(null)));
}

console.log("sessionTitle tests passed");
