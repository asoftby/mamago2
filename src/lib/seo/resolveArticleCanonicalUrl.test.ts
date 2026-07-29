import assert from "node:assert/strict";
import { resolveArticleCanonicalUrl } from "./resolveArticleCanonicalUrl";

function testStoredCanonicalPreferredCountry() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/blog/real-slug",
    slug: "real-slug",
    geoScope: "COUNTRY",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/blog/real-slug");
}

function testStoredCanonicalPreferredCity() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/blog/real-slug",
    slug: "real-slug",
    geoScope: "CITY",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/blog/real-slug");
}

function testFallsBackToNationalPath() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "real-slug",
    geoScope: "COUNTRY",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/blog/real-slug");
}

function testFallsBackToCityPath() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "real-slug",
    geoScope: "CITY",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/blog/real-slug");
}

function testStaleLocalOriginRejected() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "http://mamago.local:3000/blog/real-slug",
    slug: "real-slug",
    geoScope: "COUNTRY",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/blog/real-slug");
}

function testInvalidUrlRejected() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "not a url",
    slug: "real-slug",
    geoScope: "COUNTRY",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/blog/real-slug");
}

function testWrongEntityPathRejected() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/places/real-slug",
    slug: "real-slug",
    geoScope: "COUNTRY",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/blog/real-slug");
}

function testWrongSlugRejected() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/blog/a-different-article",
    slug: "real-slug",
    geoScope: "COUNTRY",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/blog/real-slug");
}

function testWrongCityRejected() {
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/gomel/blog/real-slug",
    slug: "real-slug",
    geoScope: "CITY",
    citySlug: "minsk",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/minsk/blog/real-slug");
}

function testCityScopedStoredValueRejectedForCountryArticle() {
  // A stored canonical carried over from before a scope change (CITY -> COUNTRY)
  // must not be trusted for the now-COUNTRY-scoped article.
  const result = resolveArticleCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/minsk/blog/real-slug",
    slug: "real-slug",
    geoScope: "COUNTRY",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/blog/real-slug");
}

function testQueryOrHashRejected() {
  for (const seoCanonicalUrl of [
    "https://mamago.by/blog/real-slug?utm_source=x",
    "https://mamago.by/blog/real-slug#comments",
  ]) {
    const result = resolveArticleCanonicalUrl({
      seoCanonicalUrl,
      slug: "real-slug",
      geoScope: "COUNTRY",
      publicBase: "https://mamago.by",
    });
    assert.equal(result, "https://mamago.by/blog/real-slug");
  }
}

testStoredCanonicalPreferredCountry();
testStoredCanonicalPreferredCity();
testFallsBackToNationalPath();
testFallsBackToCityPath();
testStaleLocalOriginRejected();
testInvalidUrlRejected();
testWrongEntityPathRejected();
testWrongSlugRejected();
testWrongCityRejected();
testCityScopedStoredValueRejectedForCountryArticle();
testQueryOrHashRejected();

console.log("resolveArticleCanonicalUrl tests: OK");
