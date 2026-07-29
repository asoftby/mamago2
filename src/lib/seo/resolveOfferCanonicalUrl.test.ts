import assert from "node:assert/strict";
import { resolveOfferCanonicalUrl } from "./resolveOfferCanonicalUrl";

const courseOffer = { kind: "CLASS", durationType: "single", campProgramType: null, slug: "real-slug" };

function testStoredCanonicalPreferred() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/offers/events/real-slug",
    offer: courseOffer,
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
}

function testFallsBackToCityScopedPathWhenNoStoredCanonical() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: null,
    offer: courseOffer,
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
}

function testLegacyNonCityScopedStoredValueRejected() {
  // Regression: syncOfferCanonical used to write the legacy /offers/{slug}
  // path (no city/section), which itself 301-redirects — a stored value
  // like this must never be trusted verbatim.
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/offers/real-slug",
    offer: courseOffer,
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
}

function testStaleLocalOriginRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "http://mamago.local:3000/minsk/offers/events/real-slug",
    offer: courseOffer,
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
}

function testWrongCityRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/gomel/offers/events/real-slug",
    offer: courseOffer,
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
}

function testWrongSectionRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/offers/camps/real-slug",
    offer: courseOffer,
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
}

function testInvalidUrlRejected() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: "not a url",
    offer: courseOffer,
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
}

function testQueryOrHashRejected() {
  for (const seoCanonicalUrl of [
    "https://mamago.by/minsk/offers/events/real-slug?preview=1",
    "https://mamago.by/minsk/offers/events/real-slug#top",
  ]) {
    const result = resolveOfferCanonicalUrl({
      seoCanonicalUrl,
      offer: courseOffer,
      citySlug: "minsk",
      publicBase: "https://mamago.by",
    });
    assert.equal(result, "https://mamago.by/minsk/offers/events/real-slug");
  }
}

function testCampSectionDerivedFromCampProgramType() {
  const result = resolveOfferCanonicalUrl({
    seoCanonicalUrl: null,
    offer: { kind: "CLASS", durationType: "recurring", campProgramType: "SUMMER", slug: "camp-slug" },
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/offers/camps/camp-slug");
}

testStoredCanonicalPreferred();
testFallsBackToCityScopedPathWhenNoStoredCanonical();
testLegacyNonCityScopedStoredValueRejected();
testStaleLocalOriginRejected();
testWrongCityRejected();
testWrongSectionRejected();
testInvalidUrlRejected();
testQueryOrHashRejected();
testCampSectionDerivedFromCampProgramType();

console.log("resolveOfferCanonicalUrl tests: OK");
