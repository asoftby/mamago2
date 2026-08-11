import assert from "node:assert/strict";
import {
  resolveScenarioItemTime,
  resolveReliableDurationMinutes,
  sortScenarioItemsByEffectiveTime,
  deriveFreeGapMinutes,
  deriveEndOfDay,
} from "./scenarioProjection";
import type { ScenarioPlanItem } from "@/server/services/dayScenario.service";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 1, hour, minute);
}

function item(overrides: Partial<Pick<ScenarioPlanItem, "startsAt" | "activity">> = {}) {
  return {
    startsAt: overrides.startsAt ?? null,
    activity: overrides.activity ?? null,
  };
}

// ── resolveScenarioItemTime ──

// Fixed PlanItem.startsAt always wins, regardless of override.
{
  const result = resolveScenarioItemTime(item({ startsAt: at(11) }), at(15));
  assert.equal(result.timeSource, "fixed");
  assert.equal(result.isFlexible, false);
  assert.equal(result.effectiveStartsAt?.getTime(), at(11).getTime());
}

// No startsAt, no sessions, no override -> genuinely flexible.
{
  const result = resolveScenarioItemTime(item(), null);
  assert.equal(result.timeSource, "flexible");
  assert.equal(result.isFlexible, true);
  assert.equal(result.effectiveStartsAt, null);
}

// Exactly one same-date session -> recovered, treated as authoritative (not flexible).
{
  const result = resolveScenarioItemTime(
    item({ activity: { sessions: [{ startsAt: at(14) }] } as never }),
    null,
  );
  assert.equal(result.timeSource, "recovered");
  assert.equal(result.isFlexible, false);
  assert.equal(result.effectiveStartsAt?.getTime(), at(14).getTime());
}

// Multiple same-date sessions -> ambiguous, never guessed; falls through to override/flexible.
{
  const result = resolveScenarioItemTime(
    item({ activity: { sessions: [{ startsAt: at(10) }, { startsAt: at(16) }] } as never }),
    null,
  );
  assert.equal(result.timeSource, "flexible");
  assert.equal(result.effectiveStartsAt, null);
}

// Override applies only when there is no authoritative source.
{
  const result = resolveScenarioItemTime(item(), at(9, 30));
  assert.equal(result.timeSource, "override");
  assert.equal(result.isFlexible, true, "override doesn't change flexible classification");
  assert.equal(result.effectiveStartsAt?.getTime(), at(9, 30).getTime());
}

// ── resolveReliableDurationMinutes: never fabricates ──
assert.equal(
  resolveReliableDurationMinutes({} as ScenarioPlanItem),
  null,
  "no reliable duration source exists yet — must never invent one",
);

// ── sortScenarioItemsByEffectiveTime ──
{
  const items = [
    { id: "flex-b", effectiveStartsAt: null, title: "Б активность", createdAt: new Date(2026, 0, 2) },
    { id: "override", effectiveStartsAt: at(9), title: "Назначено", createdAt: new Date(2026, 0, 1) },
    { id: "flex-a", effectiveStartsAt: null, title: "А активность", createdAt: new Date(2026, 0, 1) },
    { id: "fixed", effectiveStartsAt: at(14), title: "Зафиксировано", createdAt: new Date(2026, 0, 1) },
  ];
  const sorted = sortScenarioItemsByEffectiveTime(items);
  assert.deepEqual(
    sorted.map((i) => i.id),
    ["override", "fixed", "flex-a", "flex-b"],
    "effectively-timed items (fixed or override) sort chronologically before flexible items",
  );
}

// ── deriveFreeGapMinutes ──
assert.equal(
  deriveFreeGapMinutes(
    { id: "a", effectiveStartsAt: at(10), durationMinutes: null },
    { id: "b", effectiveStartsAt: at(12), durationMinutes: null },
  ),
  null,
  "unknown previous duration -> no fake gap",
);
assert.equal(
  deriveFreeGapMinutes(
    { id: "a", effectiveStartsAt: at(10), durationMinutes: 60 },
    { id: "b", effectiveStartsAt: at(12), durationMinutes: null },
  ),
  60,
  "10:00 + 60min duration ends 11:00; next starts 12:00 -> 60min gap",
);
assert.equal(
  deriveFreeGapMinutes(
    { id: "a", effectiveStartsAt: at(10), durationMinutes: 180 },
    { id: "b", effectiveStartsAt: at(12), durationMinutes: null },
  ),
  null,
  "overlap (previous ends after next starts) -> no gap, not a negative number",
);

// ── deriveEndOfDay ──
assert.equal(deriveEndOfDay([]), null);
assert.equal(
  deriveEndOfDay([{ id: "a", effectiveStartsAt: at(16), durationMinutes: null }]),
  null,
  "last item's duration unknown -> no fabricated end-of-day",
);
assert.equal(
  deriveEndOfDay([{ id: "a", effectiveStartsAt: at(16), durationMinutes: 90 }])?.getTime(),
  at(17, 30).getTime(),
);

console.log("scenarioProjection tests: OK");
