import assert from "node:assert/strict";
import { resolveEventCanonicalUrl } from "./resolveEventCanonicalUrl";

function testStoredCanonicalPreferred() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/events/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "event-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/real-slug");
}

function testFallsBackToSlugWhenNoStoredCanonical() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "minsk",
    slug: "real-slug",
    id: "event-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/real-slug");
}

function testNeverUsesIdWhenSlugExists() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "minsk",
    slug: "has-a-slug",
    id: "cuid-internal-id-should-not-appear",
    publicBase: "https://mamago.by",
  });
  assert.ok(!result.includes("cuid-internal-id-should-not-appear"));
}

function testFallsBackToIdOnlyWhenNoSlugAtAll() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "minsk",
    slug: null,
    id: "event-no-slug",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/event-no-slug");
}

function testStaleLocalOriginRejected() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: "http://mamago.local:3000/minsk/events/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "event-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/real-slug");
}

function testInvalidUrlRejected() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: "not a url",
    citySlug: "minsk",
    slug: "real-slug",
    id: "event-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/real-slug");
}

function testWrongEntityPathRejected() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/places/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "event-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/real-slug");
}

function testWrongSlugRejected() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/events/a-different-event",
    citySlug: "minsk",
    slug: "real-slug",
    id: "event-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/real-slug");
}

function testWrongCityRejected() {
  const result = resolveEventCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/gomel/events/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "event-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/events/real-slug");
}

function testQueryOrHashRejected() {
  for (const seoCanonicalUrl of [
    "https://mamago.by/minsk/events/real-slug?utm_source=x",
    "https://mamago.by/minsk/events/real-slug#sessions",
  ]) {
    const result = resolveEventCanonicalUrl({
      seoCanonicalUrl,
      citySlug: "minsk",
      slug: "real-slug",
      id: "event-1",
      publicBase: "https://mamago.by",
    });
    assert.equal(result, "https://mamago.by/minsk/events/real-slug");
  }
}

testStoredCanonicalPreferred();
testFallsBackToSlugWhenNoStoredCanonical();
testNeverUsesIdWhenSlugExists();
testFallsBackToIdOnlyWhenNoSlugAtAll();
testStaleLocalOriginRejected();
testInvalidUrlRejected();
testWrongEntityPathRejected();
testWrongSlugRejected();
testWrongCityRejected();
testQueryOrHashRejected();

console.log("resolveEventCanonicalUrl tests: OK");
