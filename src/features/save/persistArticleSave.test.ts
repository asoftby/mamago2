/**
 * Regression coverage for persistArticleSave: articles must only ever be
 * persisted as an idea (no date). "plan"/"remove-plan" results can no longer
 * be produced by the Article save UI (see SaveToPlanModal `ideaOnly`), so
 * this asserts they're rejected here too, defense-in-depth, without any
 * network call (no fictitious date ever reaches the API).
 * Run: npx tsx src/features/save/persistArticleSave.test.ts
 */
import assert from "node:assert/strict";
import { persistArticleSave } from "./persistArticleSave";

type CapturedCall = { url: string; init: RequestInit };

async function withMockedFetch(
  ok: boolean,
  run: (calls: CapturedCall[]) => Promise<void>,
) {
  const calls: CapturedCall[] = [];
  const originalFetch = globalThis.fetch;
  // @ts-expect-error — test double, not a full Fetch implementation
  globalThis.fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok } as Response;
  };
  return run(calls).finally(() => {
    globalThis.fetch = originalFetch;
  });
}

const meta = { articleId: "article-123", title: "Test article", coverImageUrl: null };

async function testIdeasSavesWithoutDate() {
  await withMockedFetch(true, async (calls) => {
    await persistArticleSave({ action: "ideas" }, meta);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/save/idea");
    assert.equal(calls[0]!.init.method, "POST");
    const body = JSON.parse(calls[0]!.init.body as string);
    assert.deepEqual(body, { articleId: "article-123" }, "no date field ever sent");
  });
}

async function testRemoveIdea() {
  await withMockedFetch(true, async (calls) => {
    await persistArticleSave({ action: "remove-idea" }, meta);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/save/idea?articleId=article-123");
    assert.equal(calls[0]!.init.method, "DELETE");
  });
}

async function testCancelIsNoop() {
  await withMockedFetch(true, async (calls) => {
    await persistArticleSave({ action: "cancel" }, meta);
    assert.equal(calls.length, 0);
  });
}

async function testPlanActionRejectedWithoutNetworkCall() {
  await withMockedFetch(true, async (calls) => {
    await assert.rejects(
      () => persistArticleSave({ action: "plan", dateISO: "2026-09-15" }, meta),
      /article_date_save_unsupported/,
      "dated save must be rejected client-side, not sent to the API",
    );
    assert.equal(calls.length, 0, "no fictitious plannedDate is ever sent to the API");
  });
}

async function testRemovePlanActionRejectedWithoutNetworkCall() {
  await withMockedFetch(true, async (calls) => {
    await assert.rejects(
      () => persistArticleSave({ action: "remove-plan", planItemId: "plan-1" }, meta),
      /article_date_save_unsupported/,
    );
    assert.equal(calls.length, 0);
  });
}

async function testIdeaSaveFailurePropagates() {
  await withMockedFetch(false, async () => {
    await assert.rejects(
      () => persistArticleSave({ action: "ideas" }, meta),
      /idea_save_failed/,
    );
  });
}

async function main() {
  await testIdeasSavesWithoutDate();
  await testRemoveIdea();
  await testCancelIsNoop();
  await testPlanActionRejectedWithoutNetworkCall();
  await testRemovePlanActionRejectedWithoutNetworkCall();
  await testIdeaSaveFailurePropagates();
  console.log("persistArticleSave (idea-only) tests: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
