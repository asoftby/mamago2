import assert from "node:assert/strict";
import { resolvePlaceCanonicalUrl } from "./resolvePlaceCanonicalUrl";

function testStoredCanonicalPreferred() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/places/some-slug",
    citySlug: "minsk",
    slug: "some-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/some-slug");
}

function testFallsBackToSlugWhenNoStoredCanonical() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "minsk",
    slug: "pugovka-na-ratomskoy-7",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/pugovka-na-ratomskoy-7");
}

function testNeverUsesIdWhenSlugExists() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "minsk",
    slug: "has-a-slug",
    id: "cuid-internal-id-should-not-appear",
    publicBase: "https://mamago.by",
  });
  assert.ok(!result.includes("cuid-internal-id-should-not-appear"));
  assert.equal(result, "https://mamago.by/minsk/places/has-a-slug");
}

function testFallsBackToIdOnlyWhenNoSlugAtAll() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "minsk",
    slug: null,
    id: "place-no-slug",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/place-no-slug");
}

function testEmptyStringStoredCanonicalTreatedAsAbsent() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "   ",
    citySlug: "minsk",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/real-slug");
}

function testStaleLocalOriginRejected() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "http://mamago.local:3000/minsk/places/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/real-slug");
}

function testInvalidUrlRejected() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "not a url",
    citySlug: "minsk",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/real-slug");
}

function testWrongEntityPathRejected() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/routes/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/real-slug");
}

function testWrongSlugRejected() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/places/a-different-place",
    citySlug: "minsk",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/real-slug");
}

// The pre-city-scoping stored canonical (no city segment) must never be
// rendered verbatim — it's the exact stale value this change replaces.
function testOldGlobalPathRejected() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/places/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/real-slug");
}

function testWrongCityRejected() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/gomel/places/real-slug",
    citySlug: "minsk",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/places/real-slug");
}

// The same slug in two different cities must resolve to two independent,
// non-colliding canonical URLs.
function testSameSlugDifferentCitiesResolveIndependently() {
  const minsk = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "minsk",
    slug: "central-park",
    id: "place-minsk",
    publicBase: "https://mamago.by",
  });
  const gomel = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    citySlug: "gomel",
    slug: "central-park",
    id: "place-gomel",
    publicBase: "https://mamago.by",
  });
  assert.equal(minsk, "https://mamago.by/minsk/places/central-park");
  assert.equal(gomel, "https://mamago.by/gomel/places/central-park");
  assert.notEqual(minsk, gomel);
}

function testQueryOrHashRejected() {
  for (const seoCanonicalUrl of [
    "https://mamago.by/minsk/places/real-slug?preview=1",
    "https://mamago.by/minsk/places/real-slug#section",
  ]) {
    const result = resolvePlaceCanonicalUrl({
      seoCanonicalUrl,
      citySlug: "minsk",
      slug: "real-slug",
      id: "place-1",
      publicBase: "https://mamago.by",
    });
    assert.equal(result, "https://mamago.by/minsk/places/real-slug");
  }
}

testStoredCanonicalPreferred();
testFallsBackToSlugWhenNoStoredCanonical();
testNeverUsesIdWhenSlugExists();
testFallsBackToIdOnlyWhenNoSlugAtAll();
testEmptyStringStoredCanonicalTreatedAsAbsent();
testStaleLocalOriginRejected();
testInvalidUrlRejected();
testWrongEntityPathRejected();
testWrongSlugRejected();
testOldGlobalPathRejected();
testWrongCityRejected();
testSameSlugDifferentCitiesResolveIndependently();
testQueryOrHashRejected();

console.log("resolvePlaceCanonicalUrl tests: OK");
