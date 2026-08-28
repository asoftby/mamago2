import assert from "node:assert/strict";
import test from "node:test";

import {
  eventSessionFingerprintFromStoredSessions,
  eventSessionScheduleFingerprint,
  replaceActivitySessionsFromScheduleJson,
} from "@/lib/business/syncEventActivitySessions";
import { formatRuSessionHero, formatRuSessionSlot } from "@/lib/event/eventPageFormat";
import { formatHHMM } from "@/lib/formatters/date";
import { getLocalDateKey } from "@/lib/date/localDateKey";

test("event schedule 12:00 Europe/Minsk persists as 09:00Z", async () => {
  const created: Date[] = [];
  const prisma = {
    activitySession: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async ({ data }: { data: Array<{ startsAt: Date }> }) => {
        created.push(...data.map((row) => row.startsAt));
        return { count: data.length };
      },
      findMany: async () => [],
    },
  };

  const scheduleJson = {
    dates: ["2026-08-29"],
    startTime: "12:00",
  };

  const count = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-1",
    scheduleJson,
  });

  assert.equal(count, 1);
  assert.equal(created[0]?.toISOString(), "2026-08-29T09:00:00.000Z");
});

test("stored session fingerprint compares in Europe/Minsk wall clock", () => {
  const scheduleJson = {
    dates: ["2026-08-29"],
    startTime: "12:00",
  };
  const stored = [{ startsAt: new Date("2026-08-29T09:00:00.000Z") }];

  assert.equal(
    eventSessionFingerprintFromStoredSessions(stored),
    eventSessionScheduleFingerprint(scheduleJson),
  );
});

test("public event time stays 12:00 regardless of UTC instant representation", () => {
  const startsAt = "2026-08-29T09:00:00.000Z";

  assert.equal(getLocalDateKey(new Date(startsAt)), "2026-08-29");
  assert.equal(formatHHMM(startsAt), "12:00");
  assert.equal(formatRuSessionSlot(startsAt), "сб, 29 авг. · 12:00");
  assert.equal(formatRuSessionHero(startsAt), "сб, 29 авг. 2026 · 12:00");
});
