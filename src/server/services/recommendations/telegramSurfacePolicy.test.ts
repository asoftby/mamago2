import assert from "node:assert/strict";
import type { RankedPlanSuggestion } from "@/server/services/planSuggestions.service";
import {
  applyTelegramSurfacePolicy,
  normalizeTelegramRecommendationPolicyConfig,
} from "./telegramSurfacePolicy";

function item(id: string, score: number, categoryId: string): RankedPlanSuggestion {
  return {
    activity: {
      id,
      slug: id,
      title: id,
      eventCategory: { id: categoryId, nameRu: categoryId },
    },
    score,
    scoreBreakdown: {
      engagementScore: score,
      freshnessSortAt: "2026-08-28T10:00:00.000Z",
      ageFilterApplied: false,
      ageFallbackUsed: false,
    },
    reasonCodes: ["ENGAGEMENT"],
  } as unknown as RankedPlanSuggestion;
}

const normalized = normalizeTelegramRecommendationPolicyConfig({
  resultCount: 50,
  horizonDays: 0,
  minimumScore: -4,
  minimumResultCount: 99,
  maxPerCategory: 99,
  repeatCooldownDays: 999,
  engagementWeight: 999,
});
assert.deepEqual(normalized, {
  resultCount: 10,
  horizonDays: 1,
  minimumScore: 0,
  minimumResultCount: 10,
  maxPerCategory: 10,
  repeatCooldownDays: 90,
});
assert.equal("engagementWeight" in normalized, false, "surface policy must not accept ranking weights");

const composed = applyTelegramSurfacePolicy({
  ranked: [
    item("a", 10, "cat-1"),
    item("b", 9, "cat-1"),
    item("c", 8, "cat-1"),
    item("d", 7, "cat-2"),
    item("e", 1, "cat-3"),
  ],
  config: {
    resultCount: 3,
    horizonDays: 7,
    minimumScore: 2,
    minimumResultCount: 2,
    maxPerCategory: 1,
    repeatCooldownDays: 7,
  },
  cooldownEntityIds: new Set(["d"]),
});
assert.deepEqual(composed.selected, [], "no-send gate must return no deliverable items");
assert.equal(composed.noSendReason, "MIN_RESULT_COUNT");
assert.deepEqual(composed.filtered, {
  belowMinimumScore: 1,
  repeatCooldown: 1,
  categoryDiversity: 2,
});

const healthy = applyTelegramSurfacePolicy({
  ranked: [item("a", 10, "cat-1"), item("b", 9, "cat-2"), item("c", 8, "cat-3")],
  config: {
    resultCount: 2,
    horizonDays: 7,
    minimumScore: 0,
    minimumResultCount: 1,
    maxPerCategory: 1,
    repeatCooldownDays: 0,
  },
});
assert.deepEqual(healthy.selected.map((row) => row.activity.id), ["a", "b"]);
assert.equal(healthy.noSendReason, null);

const empty = applyTelegramSurfacePolicy({
  ranked: [],
  config: {
    resultCount: 5,
    horizonDays: 7,
    minimumScore: 0,
    minimumResultCount: 1,
    maxPerCategory: 2,
    repeatCooldownDays: 7,
  },
});
assert.equal(empty.noSendReason, "NO_CANDIDATES");
assert.deepEqual(empty.selected, []);

console.log("telegramSurfacePolicy tests: PASS");
