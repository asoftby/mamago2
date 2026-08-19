/**
 * Regression coverage for the "article" PendingEntityType branch added for
 * Task 6 (Article Save/Share): guest clicks Heart -> auth -> resume must hit
 * the correct existing /api/save/idea|/api/save/plan endpoints with
 * articleId, mirroring the pre-existing "activity" branches.
 * Run: npx tsx src/lib/post-auth/executePendingAction.test.ts
 */
import assert from "node:assert/strict";
import { executePendingPostAuthAction } from "./executePendingAction";

type CapturedCall = { url: string; init: RequestInit };

function withMockedFetch(
  responses: Array<{ ok: boolean }>,
  run: (calls: CapturedCall[]) => Promise<void>,
) {
  const calls: CapturedCall[] = [];
  const originalFetch = globalThis.fetch;
  let callIndex = 0;
  // @ts-expect-error — test double, not a full Fetch implementation
  globalThis.fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const response = responses[callIndex] ?? { ok: true };
    callIndex += 1;
    return { ok: response.ok } as Response;
  };
  return run(calls).finally(() => {
    globalThis.fetch = originalFetch;
  });
}

async function testSaveIdeaArticleHitsSaveIdeaEndpointWithArticleId() {
  await withMockedFetch([{ ok: true }], async (calls) => {
    await executePendingPostAuthAction({
      kind: "save_idea",
      entityType: "article",
      entityId: "article-123",
      title: "Test article",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/save/idea");
    const body = JSON.parse(calls[0]!.init.body as string);
    assert.deepEqual(body, { articleId: "article-123" });
  });
}

async function testSavePlanArticleHitsSavePlanEndpointWithArticleId() {
  await withMockedFetch([{ ok: true }], async (calls) => {
    await executePendingPostAuthAction({
      kind: "save_plan",
      entityType: "article",
      entityId: "article-456",
      plannedDate: "2026-09-01",
      title: "Test article",
      coverImageUrl: "https://example.com/cover.jpg",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/save/plan");
    const body = JSON.parse(calls[0]!.init.body as string);
    assert.deepEqual(body, {
      articleId: "article-456",
      date: "2026-09-01",
      title: "Test article",
      coverImageUrl: "https://example.com/cover.jpg",
    });
  });
}

async function testSaveIdeaArticleThrowsOnFailedResponse() {
  await withMockedFetch([{ ok: false }], async () => {
    await assert.rejects(
      () =>
        executePendingPostAuthAction({
          kind: "save_idea",
          entityType: "article",
          entityId: "article-789",
        }),
      /idea_save_failed/,
    );
  });
}

async function testActivityBranchStillUnaffected() {
  // Regression guard: adding "article" must not change the pre-existing
  // "activity" routing (still /api/save/idea with activityId).
  await withMockedFetch([{ ok: true }], async (calls) => {
    await executePendingPostAuthAction({
      kind: "save_idea",
      entityType: "activity",
      entityId: "activity-1",
    });
    assert.equal(calls[0]!.url, "/api/save/idea");
    const body = JSON.parse(calls[0]!.init.body as string);
    assert.deepEqual(body, { activityId: "activity-1" });
  });
}

async function main() {
  await testSaveIdeaArticleHitsSaveIdeaEndpointWithArticleId();
  await testSavePlanArticleHitsSavePlanEndpointWithArticleId();
  await testSaveIdeaArticleThrowsOnFailedResponse();
  await testActivityBranchStillUnaffected();
  console.log("executePendingPostAuthAction (article branch) tests: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
