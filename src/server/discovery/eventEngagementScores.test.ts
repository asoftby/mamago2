/**
 * Focused tests for the canonical engagement-ranking weight table
 * (Task 5 — Content Analytics & Ranking, minimal correction).
 *
 * Proves: getEventEngagementScores() derives its SQL scoring purely from
 * ENGAGEMENT_WEIGHTS (no second hardcoded copy), PLAN_ADD outranks SAVE,
 * PAGE_VIEW traffic telemetry is excluded, scoring is deterministic, and
 * unlisted event types contribute 0 (no larger/speculative weights snuck in).
 *
 * Self-generated temporary fixture (created and torn down within this
 * file), per project convention — exercises the real exported
 * getEventEngagementScores() against the local dev DB.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/discovery/eventEngagementScores.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { getEventEngagementScores } from "./eventEngagementScores";
import { ENGAGEMENT_WEIGHTS } from "./engagementWeights";

const ENTITY_A = "test-fixture-engagement-scores-a";
const ENTITY_B = "test-fixture-engagement-scores-b";
const ENTITY_C = "test-fixture-engagement-scores-c";
const CITY_SLUG = "minsk";

async function cleanup() {
  await prisma.userEvent.deleteMany({
    where: { entityId: { in: [ENTITY_A, ENTITY_B, ENTITY_C] } },
  });
}

async function testCanonicalWeightsAreTheOnlyRuntimeSource() {
  await cleanup();
  try {
    // Write exactly one event of every weighted type onto ENTITY_A.
    for (const eventType of Object.keys(ENGAGEMENT_WEIGHTS) as Array<
      keyof typeof ENGAGEMENT_WEIGHTS
    >) {
      await trackUserEvent({
        eventType,
        entityType: "EVENT",
        entityId: ENTITY_A,
        citySlug: CITY_SLUG,
      });
    }

    const expected = Object.values(ENGAGEMENT_WEIGHTS).reduce(
      (sum, weight) => sum + (weight ?? 0),
      0,
    );

    const scores = await getEventEngagementScores([ENTITY_A]);
    assert.equal(
      scores.get(ENTITY_A),
      expected,
      "score must equal the sum of ENGAGEMENT_WEIGHTS values, proving the SQL " +
        "derives its weights from the canonical table and not a second hardcoded copy",
    );
  } finally {
    await cleanup();
  }
}

async function testPlanAddOutranksSave() {
  await cleanup();
  try {
    // ENTITY_A: a single SAVE. ENTITY_B: a single PLAN_ADD.
    await trackUserEvent({
      eventType: "SAVE",
      entityType: "EVENT",
      entityId: ENTITY_A,
      citySlug: CITY_SLUG,
    });
    await trackUserEvent({
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: ENTITY_B,
      citySlug: CITY_SLUG,
    });

    const scores = await getEventEngagementScores([ENTITY_A, ENTITY_B]);
    assert.equal(scores.get(ENTITY_A), ENGAGEMENT_WEIGHTS.SAVE);
    assert.equal(scores.get(ENTITY_B), ENGAGEMENT_WEIGHTS.PLAN_ADD);
    assert.ok(
      scores.get(ENTITY_B)! > scores.get(ENTITY_A)!,
      "PLAN_ADD must rank strictly above SAVE (product decision: committing " +
        "to a day is a stronger intent signal than bookmarking)",
    );
  } finally {
    await cleanup();
  }
}

async function testPageViewAndUnlistedEventsContributeZero() {
  await cleanup();
  try {
    assert.equal(
      ENGAGEMENT_WEIGHTS.PAGE_VIEW,
      undefined,
      "PAGE_VIEW is traffic telemetry and must not carry a content-ranking weight",
    );

    await trackUserEvent({
      eventType: "PAGE_VIEW",
      entityType: "EVENT",
      entityId: ENTITY_C,
      citySlug: CITY_SLUG,
    });
    // SEARCH_APPLY is also intentionally absent from engagement weights.
    await trackUserEvent({
      eventType: "SEARCH_APPLY",
      entityType: "EVENT",
      entityId: ENTITY_C,
      citySlug: CITY_SLUG,
    });

    const scores = await getEventEngagementScores([ENTITY_C]);
    assert.equal(scores.get(ENTITY_C), 0);
  } finally {
    await cleanup();
  }
}

async function testScoringIsDeterministicAndIndependentPerEntity() {
  await cleanup();
  try {
    await trackUserEvent({
      eventType: "CARD_VIEW",
      entityType: "EVENT",
      entityId: ENTITY_A,
      citySlug: CITY_SLUG,
    });
    await trackUserEvent({
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: ENTITY_B,
      citySlug: CITY_SLUG,
    });

    const first = await getEventEngagementScores([ENTITY_A, ENTITY_B]);
    const second = await getEventEngagementScores([ENTITY_A, ENTITY_B]);
    assert.deepEqual(
      Array.from(first.entries()).sort(),
      Array.from(second.entries()).sort(),
      "repeated calls against unchanged data must return identical scores",
    );
    assert.equal(first.get(ENTITY_A), ENGAGEMENT_WEIGHTS.CARD_VIEW);
    assert.equal(first.get(ENTITY_B), ENGAGEMENT_WEIGHTS.PLAN_ADD);
  } finally {
    await cleanup();
  }
}

async function main() {
  await testCanonicalWeightsAreTheOnlyRuntimeSource();
  await testPlanAddOutranksSave();
  await testPageViewAndUnlistedEventsContributeZero();
  await testScoringIsDeterministicAndIndependentPerEntity();
  console.log("eventEngagementScores canonical-weight tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
