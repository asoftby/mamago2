import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARTICLE_PERFORMANCE_BATCH_MAX_BYTES,
  ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS,
  ArticlePerformanceBatchSchema,
} from "./articlePerformanceAnalytics";

const sessionId = "article-session-1";

// Article-level read signals and block-level facts intentionally share one
// compact batch contract.
{
  const parsed = ArticlePerformanceBatchSchema.safeParse({
    sessionId,
    events: [
      { kind: "article_view" },
      { kind: "article_read_75" },
      { kind: "article_complete" },
      {
        kind: "impression",
        blockId: "contacts-1",
        blockType: "contacts",
        subjectId: "subject-1",
        subjectTitle: "Studio Kids",
        subjectSource: "MANUAL",
      },
      {
        kind: "action",
        blockId: "contacts-1",
        blockType: "contacts",
        subjectId: "subject-1",
        subjectTitle: "Studio Kids",
        subjectSource: "MANUAL",
        action: "phone",
        actionItemId: "phone_1",
      },
    ],
  });
  assert.equal(parsed.success, true);
}

// Hard caps are part of the server-cost contract, not UI conventions.
assert.equal(ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS, 80);
assert.equal(ARTICLE_PERFORMANCE_BATCH_MAX_BYTES, 32 * 1024);
{
  const eighty = Array.from({ length: ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS }, () => ({ kind: "article_view" as const }));
  assert.equal(ArticlePerformanceBatchSchema.safeParse({ sessionId, events: eighty }).success, true);
  assert.equal(
    ArticlePerformanceBatchSchema.safeParse({ sessionId, events: [...eighty, { kind: "article_view" }] }).success,
    false,
  );
}

// Invalid/unbounded block facts must never reach the storage endpoint.
{
  assert.equal(
    ArticlePerformanceBatchSchema.safeParse({
      sessionId,
      events: [{ kind: "action", blockId: "x", blockType: "contacts", action: "made_up_action" }],
    }).success,
    false,
  );
}

// Wiring guard: one accepted batch is one reporting-only UserEvent INSERT. It
// must bypass the generic analytics service, otherwise every article batch
// would also update behavior/recommendation/promotion projections.
{
  const route = readFileSync("src/app/api/articles/[articleId]/analytics/batch/route.ts", "utf8");
  assert.equal((route.match(/prisma\.userEvent\.create\s*\(/g) ?? []).length, 1);
  assert.equal(route.includes('from "@/server/services/analytics/AnalyticsEventService"'), false);
  assert.equal(/\btrackUserEvent\s*\(/.test(route), false);
  assert.equal(route.includes("ARTICLE_PERFORMANCE_BATCH_MAX_BYTES"), true);
  assert.equal(route.includes('article.status !== "PUBLISHED"'), true);
}

// Qualified article views come from browser-visible batched signals. Never
// regress the business report back to raw DETAIL_OPEN, which is also emitted by
// SSR detail beacons and continuous-reading navigation signals.
{
  const report = readFileSync("src/server/services/analytics/articlePerformanceStats.service.ts", "utf8");
  assert.equal(report.includes("item->>'kind' = 'article_view'"), true);
  assert.equal(report.includes('eventType: "DETAIL_OPEN"'), false);
}

console.log("articlePerformanceAnalytics.test.ts: OK");