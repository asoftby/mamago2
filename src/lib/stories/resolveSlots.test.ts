import assert from "node:assert/strict";
import { fromZonedTime } from "date-fns-tz";

import { STORY_SLOTS, DEFERRED_STORY_SLOT_IDS } from "./registry";
import { applyRenderPolicy } from "./renderPolicy";
import { resolveSlots, type SlotCounts } from "./resolveSlots";
import {
  startOfZonedDay,
  todayRange,
  zonedDateKey,
  zonedDayRange,
} from "./ranges";
import type { ResolveContext, StorySlot } from "./types";
import {
  DEFAULT_SLOT_MIN_ITEMS,
  TODAY_SLOT_MIN_ITEMS,
  DEFAULT_RENDER_POLICY,
} from "./types";

const TZ = "Europe/Minsk";
const CITY_ID = "city-test";

/** Local civil wall time in `TZ` → UTC Instant. */
function atLocal(dateKey: string, time: string): Date {
  return fromZonedTime(`${dateKey}T${time}:00`, TZ);
}

function ctxAt(dateKey: string, time = "12:00"): ResolveContext {
  return {
    now: atLocal(dateKey, time),
    timeZone: TZ,
    cityId: CITY_ID,
    hasBreakingNews: false,
  };
}

const FULL_COUNTS: SlotCounts = {
  today: Math.max(TODAY_SLOT_MIN_ITEMS, DEFAULT_SLOT_MIN_ITEMS),
  running: DEFAULT_SLOT_MIN_ITEMS,
  lastchance: DEFAULT_SLOT_MIN_ITEMS,
};

function idsOf(ctx: ResolveContext, counts: SlotCounts = FULL_COUNTS): string[] {
  return resolveSlots(STORY_SLOTS, ctx, counts).map((s) => s.id);
}

// ── Registry shape (branch a) ────────────────────────────────────────────────

{
  assert.deepEqual(
    STORY_SLOTS.map((s) => s.id),
    ["today", "running", "lastchance"],
  );
  assert.ok(DEFERRED_STORY_SLOT_IDS.includes("newplaces"));
  assert.equal(STORY_SLOTS.find((s) => s.id === "today")?.kind, "temporal");
  assert.equal(STORY_SLOTS.find((s) => s.id === "running")?.kind, "contextual");
  assert.equal(STORY_SLOTS.find((s) => s.id === "lastchance")?.kind, "contextual");
  assert.equal(DEFAULT_RENDER_POLICY.minSlotsToRender, 2);
  console.log("registry shape: OK");
}

// ── Single temporal: absorption is a no-op ───────────────────────────────────

{
  const temporalOnly: StorySlot[] = STORY_SLOTS.filter((s) => s.kind === "temporal");
  assert.equal(temporalOnly.length, 1);
  assert.equal(temporalOnly[0]?.id, "today");

  const week = [
    "2026-07-27",
    "2026-07-28",
    "2026-07-29",
    "2026-07-30",
    "2026-07-31",
    "2026-08-01",
    "2026-08-02",
  ];
  for (const date of week) {
    const ctx = ctxAt(date);
    const resolved = resolveSlots(temporalOnly, ctx, { today: 5 });
    assert.deepEqual(
      resolved.map((s) => s.id),
      ["today"],
      `${date}: single temporal must resolve to [today] (absorption no-op)`,
    );
    const range = todayRange(ctx);
    assert.equal(resolved[0]!.range.start.getTime(), range.start.getTime());
    assert.equal(resolved[0]!.range.end.getTime(), range.end.getTime());
  }
  console.log("single-temporal absorption no-op: OK");
}

// ── Weekday order: today then running; lastchance gated ──────────────────────

{
  const cases: Array<{ date: string; day: string }> = [
    { date: "2026-07-27", day: "Mon" },
    { date: "2026-07-31", day: "Fri" },
    { date: "2026-08-01", day: "Sat" },
    { date: "2026-08-02", day: "Sun" },
  ];
  for (const { date, day } of cases) {
    const got = idsOf(ctxAt(date));
    assert.deepEqual(
      got,
      ["today", "running"],
      `${day} ${date}: expected [today, running], got [${got.join(", ")}]`,
    );
  }
  console.log("weekday today+running order: OK");
}

// ── lastchance condition false until flagged ─────────────────────────────────

{
  const resolved = resolveSlots(STORY_SLOTS, ctxAt("2026-07-27"), FULL_COUNTS);
  assert.ok(!resolved.some((s) => s.id === "lastchance"));

  const withFlag = resolveSlots(
    STORY_SLOTS,
    { ...ctxAt("2026-07-27"), hasLastChanceOffers: true },
    FULL_COUNTS,
  );
  assert.deepEqual(
    withFlag.map((s) => s.id),
    ["today", "running", "lastchance"],
  );
  console.log("lastchance condition: OK");
}

// ── absorption temporal-only: wide contextual does not absorb today ──────────

{
  const slots: StorySlot[] = [
    ...STORY_SLOTS,
    {
      id: "wide-editorial",
      kind: "editorial",
      label: () => "Wide",
      range: () => ({
        start: startOfZonedDay("2026-07-01", TZ),
        end: startOfZonedDay("2026-09-01", TZ),
      }),
      priority: 5,
      minItems: 1,
    },
  ];
  const counts: SlotCounts = { ...FULL_COUNTS, "wide-editorial": 1 };
  const resolved = resolveSlots(slots, ctxAt("2026-07-27"), counts);
  assert.ok(resolved.some((s) => s.id === "today"));
  assert.ok(resolved.some((s) => s.id === "running"));
  assert.ok(resolved.some((s) => s.id === "wide-editorial"));
  assert.equal(resolved[0]?.id, "wide-editorial");
  console.log("absorption temporal-only: OK");
}

// ── Forced second temporal covering today: today survives (absorbable:false) ─

{
  const slots: StorySlot[] = [
    ...STORY_SLOTS,
    {
      id: "wide-day",
      kind: "temporal",
      label: () => "Wide day",
      range: (ctx) => {
        const key = zonedDateKey(ctx.now, ctx.timeZone);
        return zonedDayRange(key, 3, ctx.timeZone);
      },
      priority: 5,
      minItems: 1,
    },
  ];
  const counts: SlotCounts = { ...FULL_COUNTS, "wide-day": 3 };
  const resolved = resolveSlots(slots, ctxAt("2026-07-27"), counts);
  assert.ok(resolved.some((s) => s.id === "today"), "today absorbable:false");
  // wide-day is absorbable and equal? No — today ⊂ wide-day so today would be
  // absorbed IF absorbable; it isn't. wide-day stays.
  assert.ok(resolved.some((s) => s.id === "wide-day"));
  console.log("today absorbable:false vs covering temporal: OK");
}

// ── minItems drop ────────────────────────────────────────────────────────────

{
  const counts: SlotCounts = {
    today: 0,
    running: 4,
    lastchance: 0,
  };
  const resolved = resolveSlots(STORY_SLOTS, ctxAt("2026-07-27"), counts);
  assert.deepEqual(
    resolved.map((s) => s.id),
    ["running"],
  );
  console.log("minItems drop: OK");
}

// ── render policy: minSlotsToRender 2 ────────────────────────────────────────

{
  const both = resolveSlots(STORY_SLOTS, ctxAt("2026-07-27"), FULL_COUNTS);
  assert.equal(both.length, 2);
  assert.deepEqual(
    applyRenderPolicy(both, DEFAULT_RENDER_POLICY).map((s) => s.id),
    ["today", "running"],
  );

  const onlyRunning = resolveSlots(STORY_SLOTS, ctxAt("2026-07-27"), {
    today: 0,
    running: 4,
  });
  assert.equal(onlyRunning.length, 1);
  assert.deepEqual(applyRenderPolicy(onlyRunning, DEFAULT_RENDER_POLICY), []);
  assert.deepEqual(
    applyRenderPolicy(onlyRunning, { maxSlots: 6, minSlotsToRender: 1 }).map(
      (s) => s.id,
    ),
    ["running"],
  );
  console.log("render policy minSlotsToRender: OK");
}

// ── TZ day boundary ──────────────────────────────────────────────────────────

{
  const late = resolveSlots(STORY_SLOTS, ctxAt("2026-07-30", "23:50"), FULL_COUNTS).find(
    (s) => s.id === "today",
  )!;
  const early = resolveSlots(STORY_SLOTS, ctxAt("2026-07-31", "00:10"), FULL_COUNTS).find(
    (s) => s.id === "today",
  )!;
  assert.equal(zonedDateKey(late.range.start, TZ), "2026-07-30");
  assert.equal(zonedDateKey(early.range.start, TZ), "2026-07-31");
  console.log("TZ day boundary: OK");
}

// ── labels ───────────────────────────────────────────────────────────────────

{
  const resolved = resolveSlots(STORY_SLOTS, ctxAt("2026-07-27"), FULL_COUNTS);
  assert.equal(resolved.find((s) => s.id === "today")?.label, "Сегодня");
  assert.equal(resolved.find((s) => s.id === "running")?.label, "Идёт сейчас");
  console.log("labels: OK");
}

console.log("\nresolveSlots tests: all OK");
