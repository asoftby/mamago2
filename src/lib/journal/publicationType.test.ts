import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertJournalExpiryShape,
  assertJournalLinkedItemsShape,
  defaultBreakingNewsExpiresAt,
  isJournalPublicationExpired,
  resolveBreakingNewsExpiresAtOnPublish,
  resolveJournalExpiresAt,
  resolvePublishTimestamps,
} from "./publicationType";

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: "EVENT" as const, id: `e${i}` }));

test("news expiresAt defaults to publishedAt + 14 days", () => {
  const publishedAt = new Date("2026-10-01T10:00:00Z");
  assert.equal(defaultBreakingNewsExpiresAt(publishedAt).toISOString(), "2026-10-15T10:00:00.000Z");
  assert.equal(
    resolveJournalExpiresAt({ publicationType: "BREAKING_NEWS", expiresAt: null, publishedAt })?.toISOString(),
    "2026-10-15T10:00:00.000Z",
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
  assert.equal(resolveBreakingNewsExpiresAtOnPublish(null, publishedAt).toISOString(), "2026-11-03T00:00:00.000Z");
  assert.equal(
    resolveBreakingNewsExpiresAtOnPublish(new Date("2026-10-01T00:00:00Z"), publishedAt).toISOString(),
    "2026-11-03T00:00:00.000Z",
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

test("first publish sets publishedAt = now and news expiresAt = now + 14 days", () => {
  const now = new Date("2026-11-01T09:00:00Z");
  const news = resolvePublishTimestamps(
    { status: "DRAFT", publishedAt: null, expiresAt: null, publicationType: "BREAKING_NEWS" },
    now,
  );
  assert.equal(news.publishedAt.toISOString(), now.toISOString());
  assert.equal(news.expiresAt?.toISOString(), "2026-11-15T09:00:00.000Z");
  const article = resolvePublishTimestamps(
    { status: "PENDING", publishedAt: null, expiresAt: null, publicationType: "ARTICLE" },
    now,
  );
  assert.equal(article.publishedAt.toISOString(), now.toISOString());
  assert.ok(!("expiresAt" in article), "non-news types never get an expiry");
});

test("re-submitting an already published article keeps publishedAt and expiresAt", () => {
  const publishedAt = new Date("2026-10-01T10:00:00Z");
  const expiresAt = new Date("2026-10-15T10:00:00Z");
  const later = new Date("2026-11-07T12:00:00Z"); // after expiry: must not be revived either
  for (const publicationType of ["BREAKING_NEWS", "ARTICLE"] as const) {
    const next = resolvePublishTimestamps({ status: "PUBLISHED", publishedAt, expiresAt, publicationType }, later);
    assert.equal(next.publishedAt, publishedAt, `${publicationType}: publishedAt is not bumped`);
    assert.ok(!("expiresAt" in next), `${publicationType}: expiresAt is left untouched (not written)`);
  }
});

test("a legacy PUBLISHED row without publishedAt gets one on re-submit", () => {
  const now = new Date("2026-11-01T09:00:00Z");
  const next = resolvePublishTimestamps(
    { status: "PUBLISHED", publishedAt: null, expiresAt: null, publicationType: "BREAKING_NEWS" },
    now,
  );
  assert.equal(next.publishedAt.toISOString(), now.toISOString());
  assert.equal(next.expiresAt?.toISOString(), "2026-11-15T09:00:00.000Z");
});

test("moderateArticle publishes through resolvePublishTimestamps and reads current status/dates", () => {
  const src = readFileSync("src/lib/article/articleAdminService.ts", "utf8");
  const body = src.slice(src.indexOf("export async function moderateArticle"), src.indexOf("export async function setArticleJournalFlags"));
  assert.match(body, /status: true, publishedAt: true/, "current status and dates are loaded");
  assert.match(body, /\.\.\.resolvePublishTimestamps\(row, new Date\(\)\)/);
  assert.doesNotMatch(body, /publishedAt = new Date\(\)/, "no unconditional publishedAt reset");
});
