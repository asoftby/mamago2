import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARTICLE_PERFORMANCE_BATCH_MAX_BYTES,
  ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS,
  ArticlePerformanceBatchSchema,
} from "./articlePerformanceAnalytics";
import {
  ArticleContentPayloadSchema,
  articleContentValidationMessage,
  newBlock,
  prepareArticleContentForSave,
} from "@/lib/publications/articleMvp";

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

// Empty new structured blocks are saveable, but their stable subject identity
// must survive save/reopen. Once data is added, that same new-format block must
// require a subject title. Genuine legacy blocks without subject remain valid.
{
  const fresh = newBlock("contacts", () => "subject-persistence");
  assert.equal(fresh.type, "contacts");
  if (fresh.type === "contacts") {
    const savedEmpty = ArticleContentPayloadSchema.parse(
      prepareArticleContentForSave({ version: 1, blocks: [fresh] }),
    );
    const reopened = savedEmpty.blocks[0];
    assert.equal(
      reopened?.type === "contacts" ? reopened.subject?.id : null,
      "subject_subject-persistence",
    );

    if (reopened?.type === "contacts") {
      const populated = prepareArticleContentForSave({
        version: 1,
        blocks: [{ ...reopened, data: { ...reopened.data, address: "Минск" } }],
      });
      const result = ArticleContentPayloadSchema.safeParse(populated);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(
          articleContentValidationMessage(result.error.issues),
          "Укажите, к какому объекту относится блок",
        );
      }
    }
  }

  assert.equal(
    ArticleContentPayloadSchema.safeParse({
      version: 1,
      blocks: [{ id: "legacy-contacts", type: "contacts", data: { address: "Минск", phones: [], socials: [] } }],
    }).success,
    true,
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
// regress the business report back to raw DETAIL_OPEN. Product periods must use
// the canonical Belarus timezone and half-open boundaries rather than server TZ.
{
  const report = readFileSync("src/server/services/analytics/articlePerformanceStats.service.ts", "utf8");
  assert.equal(report.includes("item->>'kind' = 'article_view'"), true);
  assert.equal(report.includes('eventType: "DETAIL_OPEN"'), false);
  assert.equal(report.includes("DEFAULT_TZ"), true);
  assert.equal(report.includes("startOfZonedDay"), true);
  assert.equal(report.includes("createdAt: { gte: start, lt: endExclusive }"), true);
  assert.equal(report.includes('e."createdAt" < ${endExclusive}'), true);
}

// Empty structured sections omitted by ArticleInfoCard must also be omitted
// from impression descriptors, otherwise per-block impressions become false.
{
  const view = readFileSync("src/components/article/mvp/ArticleMvpView.tsx", "utf8");
  assert.equal(view.includes("function structuredBlockRenders("), true);
  assert.equal(view.includes(".filter(structuredBlockRenders)"), true);
}

// Route clicks are classified from the rendered control semantics, so Yandex,
// 2GIS and other legitimate map providers cannot fall through as website clicks.
{
  const client = readFileSync("src/components/article/analytics/ArticlePerformanceAnalytics.tsx", "utf8");
  assert.equal(client.includes('controlLabel.includes("маршрут")'), true);
  assert.equal(client.includes('controlLabel.includes("открыть на карте")'), true);
}

// Reading depth must never manufacture the qualified article view. A short
// article can be 75%/100% visible on first layout, but those milestones are only
// eligible after the independent 1s dwell has fired article_view. The dwell
// callback re-measures depth afterwards so legitimately short articles still
// receive their read milestones without extra requests.
{
  const client = readFileSync("src/components/article/analytics/ArticlePerformanceAnalytics.tsx", "utf8");
  const guard = client.indexOf('if (!hasQualifiedView()) return;');
  const firstReadSignal = client.indexOf('queueSignal("article_read_75")', guard);
  assert.ok(guard >= 0);
  assert.ok(firstReadSignal > guard);
  assert.equal(client.includes('const hasQualifiedView = () => firedRef.current.has("article_view")'), true);
  assert.equal(client.includes('queueView();\n              viewTimer = null;\n              // Re-measure after qualification'), true);
  assert.equal(client.includes('queueView();\n        queueSignal("article_read_75")'), false);
}

console.log("articlePerformanceAnalytics.test.ts: OK");