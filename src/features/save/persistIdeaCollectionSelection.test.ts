import assert from "node:assert/strict";
import { persistIdeaCollectionSelection } from "./persistIdeaCollectionSelection";

const originalFetch = globalThis.fetch;

async function withFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
  callback: () => Promise<void>,
) {
  globalThis.fetch = handler as typeof fetch;
  try { await callback(); }
  finally { globalThis.fetch = originalFetch; }
}

async function run() {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    throw new Error("unexpected fetch");
  }, async () => {
    await persistIdeaCollectionSelection({ collectionIds: [] }, { articleId: "article-1" });
  });
  assert.equal(calls, 0, "saving without a collection does not make an extra request");

  const written: Array<{ url: string; method: string; body: unknown }> = [];
  await withFetch(async (url, init) => {
    written.push({ url, method: init?.method ?? "GET", body: JSON.parse(String(init?.body ?? "{}")) });
    return Response.json({ success: true });
  }, async () => {
    await persistIdeaCollectionSelection({ collectionIds: ["collection-1", "collection-1"] }, { articleId: "article-1" });
  });
  assert.deepEqual(written, [{
    url: "/api/save/idea/collections",
    method: "PUT",
    body: { articleId: "article-1", collectionIds: ["collection-1"] },
  }], "membership writes are deduplicated and scoped to one saved article");

  written.length = 0;
  await withFetch(async (url, init) => {
    written.push({ url, method: init?.method ?? "GET", body: JSON.parse(String(init?.body ?? "{}")) });
    if (url === "/api/collections") return Response.json({ collection: { id: "new-1" } }, { status: 201 });
    return Response.json({ success: true });
  }, async () => {
    await persistIdeaCollectionSelection({ collectionIds: ["old-1"], newCollectionTitle: "Поездки" }, { offerId: "offer-1" });
  });
  assert.equal(written.length, 2, "create and attach happen in order");
  assert.deepEqual(written[0]?.body, { title: "Поездки" });
  assert.deepEqual(written[1]?.body, { offerId: "offer-1", collectionIds: ["old-1", "new-1"] });

  written.length = 0;
  await withFetch(async (url, init) => {
    written.push({ url, method: init?.method ?? "GET", body: JSON.parse(String(init?.body ?? "{}")) });
    return Response.json({ success: true });
  }, async () => {
    await persistIdeaCollectionSelection({ collectionIds: [], syncCollections: true }, { routeId: "route-1" });
  });
  assert.deepEqual(written[0]?.body, { routeId: "route-1", collectionIds: [] }, "removing every membership retains the idea");

  let writesAfterFailure = 0;
  await withFetch(async (url) => {
    if (url === "/api/collections") return Response.json({ error: "COLLECTION_EXISTS" }, { status: 409 });
    writesAfterFailure += 1;
    return Response.json({ success: true });
  }, async () => {
    await assert.rejects(
      persistIdeaCollectionSelection({ newCollectionTitle: "Duplicate" }, { placeId: "place-1" }),
      /collection_create_failed:COLLECTION_EXISTS/,
    );
  });
  assert.equal(writesAfterFailure, 0, "a failed create never reassigns an idea");
  await assert.rejects(
    persistIdeaCollectionSelection({ collectionIds: ["c"] }, undefined),
    /idea_collection_target_missing/,
  );
  console.log("Idea collection save selection tests: OK");
}

void run();
