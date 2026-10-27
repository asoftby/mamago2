import assert from "node:assert/strict";
import test from "node:test";
import {
  assertJournalExpiryShape,
  assertJournalLinkedItemsShape,
  defaultBreakingNewsExpiresAt,
  isJournalPublicationExpired,
  resolveBreakingNewsExpiresAtOnPublish,
  resolveJournalExpiresAt,
} from "./publicationType";

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: "EVENT" as const, id: `e${i}` }));

test("news expiresAt defaults to publishedAt + 7 days", () => {
  const publishedAt = new Date("2026-10-01T10:00:00Z");
  assert.equal(defaultBreakingNewsExpiresAt(publishedAt).toISOString(), "2026-10-08T10:00:00.000Z");
  assert.equal(
    resolveJournalExpiresAt({ publicationType: "BREAKING_NEWS", expiresAt: null, publishedAt })?.toISOString(),
    "2026-10-08T10:00:00.000Z",
  );
});

test("explicit expiresAt is kept; non-news types keep their value", () => {
  const explicit = new Date("2026-12-01T00:00:00Z");
  assert.equal(resolveJournalExpiresAt({ publicationType: "BREAKING_NEWS", expiresAt: explicit, publishedAt: null }), explicit);
  assert.equal(resolveJournalExpiresAt({ publicationType: "ARTICLE", expiresAt: null, publishedAt: new Date() }), null);
  assert.equal(resolveJournalExpiresAt({ publicationType: "BREAKING_NEWS", expiresAt: null, publishedAt: null }), null);
});

test("publishing news sets a fresh default when expiry is missing or past", () => {
  const publishedAt = new Date("2026-10-20T00:00:00Z");
  assert.equal(resolveBreakingNewsExpiresAtOnPublish(null, publishedAt).toISOString(), "2026-10-27T00:00:00.000Z");
  assert.equal(
    resolveBreakingNewsExpiresAtOnPublish(new Date("2026-10-01T00:00:00Z"), publishedAt).toISOString(),
    "2026-10-27T00:00:00.000Z",
  );
  const future = new Date("2026-11-30T00:00:00Z");
  assert.equal(resolveBreakingNewsExpiresAtOnPublish(future, publishedAt), future);
});

test("collection requires at least 3 items", () => {
  assert.throws(() => assertJournalLinkedItemsShape({ publicationType: "COLLECTION", items: items(2) }), /минимум 3/);
  assert.doesNotThrow(() => assertJournalLinkedItemsShape({ publicationType: "COLLECTION", items: items(3) }));
  assert.doesNotThrow(() => assertJournalLinkedItemsShape({ publicationType: "ARTICLE", items: [] }));
});

test("linked items must be unique and not self", () => {
  assert.throws(
    () => assertJournalLinkedItemsShape({ publicationType: "ARTICLE", items: [{ kind: "OFFER", id: "o" }, { kind: "OFFER", id: "o" }] }),
    /не должны повторяться/,
  );
  assert.doesNotThrow(() =>
    assertJournalLinkedItemsShape({ publicationType: "ARTICLE", items: [{ kind: "OFFER", id: "x" }, { kind: "EVENT", id: "x" }] }),
  );
  assert.throws(
    () => assertJournalLinkedItemsShape({ articleId: "a1", publicationType: "ARTICLE", items: [{ kind: "ARTICLE", id: "a1" }] }),
    /саму себя/,
  );
});

test("news requires expiresAt after publishedAt", () => {
  const publishedAt = new Date("2026-10-01T00:00:00Z");
  assert.throws(() => assertJournalExpiryShape({ publicationType: "BREAKING_NEWS", expiresAt: null, publishedAt, publishLike: true }), /Актуально до/);
  assert.doesNotThrow(() => assertJournalExpiryShape({ publicationType: "BREAKING_NEWS", expiresAt: null, publishedAt: null, publishLike: false }));
  assert.throws(() => assertJournalExpiryShape({ publicationType: "BREAKING_NEWS", expiresAt: publishedAt, publishedAt, publishLike: true }), /позже/);
  assert.doesNotThrow(() => assertJournalExpiryShape({ publicationType: "ARTICLE", expiresAt: null, publishedAt, publishLike: true }));
});

test("only breaking news expire", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  assert.equal(isJournalPublicationExpired({ publicationType: "BREAKING_NEWS", expiresAt: new Date("2026-10-09T00:00:00Z") }, now), true);
  assert.equal(isJournalPublicationExpired({ publicationType: "BREAKING_NEWS", expiresAt: new Date("2026-10-11T00:00:00Z") }, now), false);
  assert.equal(isJournalPublicationExpired({ publicationType: "BREAKING_NEWS", expiresAt: null }, now), true);
  assert.equal(isJournalPublicationExpired({ publicationType: "ARTICLE", expiresAt: new Date("2020-01-01T00:00:00Z") }, now), false);
  assert.equal(isJournalPublicationExpired({ publicationType: "COLLECTION", expiresAt: null }, now), false);
});
