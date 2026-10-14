import assert from "node:assert/strict";
import { ideaCollectionErrorResponse } from "./ideaCollections.http";
import {
  COLLECTION_TITLE_MAX,
  IdeaCollectionError,
  normalizeCollectionTitle,
  parseIdeaTarget,
  type IdeaCollectionErrorCode,
} from "./ideaCollections.service";

async function main() {
  const expected: Array<[IdeaCollectionErrorCode, number]> = [
    ["IDEA_NOT_FOUND", 404],
    ["COLLECTION_NOT_FOUND", 404],
    ["COLLECTION_EXISTS", 409],
    ["COLLECTION_LIMIT", 422],
    ["INVALID_TITLE", 400],
  ];
  for (const [code, status] of expected) {
    const res = ideaCollectionErrorResponse(new IdeaCollectionError(code));
    assert.equal(res?.status, status, code);
    assert.deepEqual(await res?.json(), { error: code });
  }
  assert.equal(ideaCollectionErrorResponse(new Error("boom")), null);

  // Title: trim + collapse spaces, 1..60.
  assert.equal(normalizeCollectionTitle("  Новый   год "), "Новый год");
  assert.equal(normalizeCollectionTitle("x".repeat(COLLECTION_TITLE_MAX)).length, COLLECTION_TITLE_MAX);
  for (const bad of ["", "   ", "x".repeat(COLLECTION_TITLE_MAX + 1), null, 5]) {
    assert.throws(() => normalizeCollectionTitle(bad), (e) => e instanceof IdeaCollectionError && e.code === "INVALID_TITLE");
  }

  // Target parsing (body object and URLSearchParams).
  assert.deepEqual(parseIdeaTarget({ offerId: " o1 " }), { kind: "OFFER", id: "o1" });
  assert.deepEqual(parseIdeaTarget(new URLSearchParams("activityId=a1")), { kind: "ACTIVITY", id: "a1" });
  assert.equal(parseIdeaTarget({}), null);
  assert.equal(parseIdeaTarget({ activityId: "  " }), null);

  console.log("ideaCollections.http.test: ok");
}

void main();
