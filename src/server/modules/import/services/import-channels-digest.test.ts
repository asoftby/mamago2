import assert from "node:assert/strict";
import {
  formatChannelsDigest,
  isDigestDue,
  minskDateKey,
  type ChannelsDigestStats,
} from "./import-channels-digest.service";

const stats = (over: Partial<ChannelsDigestStats> = {}): ChannelsDigestStats => ({
  windowHours: 24, sources: 1, newRecords: 14, possibleDuplicates: 6, changedPublished: 3, waiting: 23,
  aiCalls: 48, tokensIn: 40_000, tokensOut: 12_000,
  bySource: [{ sourceId: "s1", name: "Детская афиша", newRecords: 14, waiting: 23, aiCalls: 48, tokens: 52_000 }],
  ...over,
});

// ── Time: 09:00 Minsk (UTC+3, no DST) ───────────────────────────────────────
assert.equal(isDigestDue(new Date("2026-10-30T05:59:00Z")), false, "08:59 Minsk");
assert.equal(isDigestDue(new Date("2026-10-30T06:00:00Z")), true, "09:00 Minsk");
assert.equal(isDigestDue(new Date("2026-10-30T20:59:00Z")), true, "23:59 Minsk");
assert.equal(isDigestDue(new Date("2026-10-30T21:00:00Z")), false, "00:00 Minsk next day");
assert.equal(minskDateKey(new Date("2026-10-30T20:59:00Z")), "2026-10-30");
assert.equal(minskDateKey(new Date("2026-10-30T21:00:00Z")), "2026-10-31", "date changes at midnight Minsk, not UTC");

// ── Text ─────────────────────────────────────────────────────────────────────
{
  const message = formatChannelsDigest(stats())!;
  assert.equal(message.title, "Каналы: сводка за сутки");
  assert.match(message.body, /14 новых постов, 6 возможных дублей, 3 изменения в опубликованных\. Ждёт решения: 23\./);
  assert.match(message.body, /Модель: 48 вызовов, 52 тыс\. токенов\./);
  assert.match(message.body, /• Детская афиша: 14 новых, ждёт 23, 48 выз\., 52 тыс\. ток\./);
}
// Russian plural forms.
{
  const one = formatChannelsDigest(stats({ newRecords: 1, possibleDuplicates: 1, changedPublished: 1, aiCalls: 1, tokensIn: 100, tokensOut: 50 }))!;
  assert.match(one.body, /1 новый пост, 1 возможный дубль, 1 изменение в опубликованных/);
  assert.match(one.body, /Модель: 1 вызов, 150 токенов\./);
  const few = formatChannelsDigest(stats({ newRecords: 3, possibleDuplicates: 2, changedPublished: 4 }))!;
  assert.match(few.body, /3 новых поста, 2 возможных дубля, 4 изменения/);
  const teens = formatChannelsDigest(stats({ newRecords: 12, possibleDuplicates: 11, changedPublished: 21 }))!;
  assert.match(teens.body, /12 новых постов, 11 возможных дублей, 21 изменение/);
}
// No model line when the model was not used.
assert.doesNotMatch(formatChannelsDigest(stats({ aiCalls: 0, tokensIn: 0, tokensOut: 0 }))!.body, /Модель:/);
// Nothing to say: no message.
assert.equal(formatChannelsDigest(stats({ sources: 0 })), null);
assert.equal(formatChannelsDigest(stats({ newRecords: 0, changedPublished: 0, waiting: 0, aiCalls: 0, possibleDuplicates: 0 })), null);
// Only a backlog is still worth a line.
assert.ok(formatChannelsDigest(stats({ newRecords: 0, changedPublished: 0, aiCalls: 0, possibleDuplicates: 0, waiting: 5 })));
// At most five sources in the text; the busiest first.
{
  const many = Array.from({ length: 8 }, (_, i) => ({ sourceId: `s${i}`, name: `Канал ${i}`, newRecords: i, waiting: 0, aiCalls: 0, tokens: 0 }));
  const body = formatChannelsDigest(stats({ bySource: many }))!.body;
  assert.equal(body.split("\n").filter((l) => l.startsWith("•")).length, 5);
  assert.match(body, /Канал 7/);
  assert.doesNotMatch(body, /Канал 1:/);
}

console.log("import-channels-digest tests: OK");
