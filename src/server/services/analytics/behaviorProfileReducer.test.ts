/**
 * Pure Analytics Contract v1 tests for the behavior-profile reducer.
 * Run: pnpm exec tsx src/server/services/analytics/behaviorProfileReducer.test.ts
 */
import assert from "node:assert/strict";
import {
  emptyBehaviorProfileSnapshot,
  reduceBehaviorProfileEvent,
  reduceBehaviorProfileEvents,
} from "./behaviorProfileReducer";

function main() {
  const t0 = new Date("2026-01-01T10:00:00.000Z");
  const t1 = new Date("2026-01-02T10:00:00.000Z");
  const t2 = new Date("2026-01-03T10:00:00.000Z");

  const profile = reduceBehaviorProfileEvents([
    {
      eventType: "PAGE_VIEW",
      vertical: "CITY",
      meta: { categorySlug: "kino" },
      createdAt: t0,
    },
    {
      eventType: "CARD_VIEW",
      vertical: "CITY",
      meta: { categorySlug: "kino" },
      createdAt: t1,
    },
    {
      eventType: "CARD_VIEW",
      vertical: "CITY",
      meta: { articleEvent: "article_telegram_cta_impression" },
      createdAt: t1,
    },
    {
      eventType: "CTA_CLICK",
      vertical: "CITY",
      meta: { articleEvent: "article_complete", categorySlug: "kino" },
      createdAt: t1,
    },
    {
      eventType: "CTA_CLICK",
      vertical: "CITY",
      meta: { targetAction: "website", categorySlug: "kino" },
      createdAt: t2,
    },
    {
      eventType: "PLAN_ADD",
      vertical: "WEEKEND",
      meta: { planningTiming: "weekend", categorySlug: "festival" },
      createdAt: t2,
    },
    {
      eventType: "PLAN_REMOVE",
      vertical: "WEEKEND",
      meta: { categorySlug: "festival" },
      createdAt: t2,
    },
  ]);

  assert.equal(profile.totalViews, 1, "PAGE_VIEW and inner CTA impressions are not content views");
  assert.equal(profile.totalCtaClicks, 1, "article reading transport does not count as CTA");
  assert.equal(profile.totalPlanAdds, 1, "PLAN_REMOVE does not erase historical planning intent");
  assert.deepEqual(profile.preferredVerticals, { CITY: 2, WEEKEND: 1 });
  assert.deepEqual(profile.preferredCategories, { kino: 2, festival: 1 });
  assert.deepEqual(profile.planningBuckets, { same_day: 0, weekend: 1, advance: 0 });
  assert.equal(profile.weekendShare, 1);
  assert.equal(profile.firstSeenAt?.toISOString(), t0.toISOString(), "firstSeen includes traffic activity");
  assert.equal(profile.lastSeenAt?.toISOString(), t2.toISOString());

  const older = reduceBehaviorProfileEvent(emptyBehaviorProfileSnapshot(), {
    eventType: "SAVE",
    createdAt: t2,
  });
  const withEarlier = reduceBehaviorProfileEvent(older, {
    eventType: "PAGE_VIEW",
    createdAt: t0,
  });
  assert.equal(withEarlier.firstSeenAt?.toISOString(), t0.toISOString());
  assert.equal(withEarlier.lastSeenAt?.toISOString(), t2.toISOString());

  console.log("behaviorProfileReducer.test.ts: OK");
}

main();
