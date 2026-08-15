import assert from "node:assert/strict";
import { resolveOfferCanonicalUrl } from "./resolveOfferCanonicalUrl";

function testStoredCanonicalPreferred() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/offers/real-slug",
    slug: "real-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
}

function testFallsBackToCityScopedPathWhenNoStoredCanonical() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "real-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
}

function testLegacyNonCityScopedStoredValueRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/offers/real-slug",
    slug: "real-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
}

// Regression: the old canonical included {section}. A stored value from
// before this change must never be trusted verbatim — section is no
// longer part of the canonical identity at all.
function testLegacySectionScopedStoredValueRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/offers/camps/real-slug",
    slug: "real-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
}

function testStaleLocalOriginRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "http://mamago.local:3000/minsk/offers/real-slug",
    slug: "real-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
}

function testWrongCityRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/gomel/offers/real-slug",
    slug: "real-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
}

function testInvalidUrlRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "not a url",
    slug: "real-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
}

function testQueryOrHashRejected() {
  for (const seoCanonicalUrl of [
    "https://mamago.by/minsk/offers/real-slug?preview=1",
    "https://mamago.by/minsk/offers/real-slug#top",
  ]) {
    const result = resolveOfferCanonicalUrl({
      seoCanonicalUrl,
      slug: "real-slug",
      citySlug: "minsk",
      publicBase: "https://mamago.by",
    });
    assert.equal(result, "https://mamago.by/minsk/offers/real-slug");
  }
}

// The same slug in two different cities must resolve independently.
function testSameSlugDifferentCitiesResolveIndependently() {
  const minsk = resolveOfferCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "summer-camp",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  const gomel = resolveOfferCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "summer-camp",
    citySlug: "gomel",
    publicBase: "https://mamago.by",
  });
  assert.equal(minsk, "https://mamago.by/minsk/offers/summer-camp");
  assert.equal(gomel, "https://mamago.by/gomel/offers/summer-camp");
  assert.notEqual(minsk, gomel);
}

// Changing an offer's section/category (kind/durationType/campProgramType)
// must never change its canonical URL — section isn't part of identity.
function testSectionIsIrrelevantToCanonical() {
  const beforeSectionChange = resolveOfferCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "camp-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  const afterSectionChange = resolveOfferCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "camp-slug",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(beforeSectionChange, afterSectionChange);
  assert.equal(beforeSectionChange, "https://mamago.by/minsk/offers/camp-slug");
}

testStoredCanonicalPreferred();
testFallsBackToCityScopedPathWhenNoStoredCanonical();
testLegacyNonCityScopedStoredValueRejected();
testLegacySectionScopedStoredValueRejected();
testStaleLocalOriginRejected();
testWrongCityRejected();
testInvalidUrlRejected();
testQueryOrHashRejected();
testSameSlugDifferentCitiesResolveIndependently();
testSectionIsIrrelevantToCanonical();

console.log("resolveOfferCanonicalUrl tests: OK");
