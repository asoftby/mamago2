import assert from "node:assert/strict";
import {
  resolvePublicRouteCanonicalUrl,
  resolveRouteCanonicalUrl,
} from "./resolveRouteCanonicalUrl";

function testStoredCanonicalPreferred() {
  const result = resolveRouteCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/routes/some-slug",
    slug: "some-slug",
    id: "route-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/routes/some-slug");
}

function testFallsBackToSlugWhenNoStoredCanonical() {
  const result = resolveRouteCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "marshrut-mogilev",
    id: "route-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/routes/marshrut-mogilev");
}

function testNeverUsesIdWhenSlugExists() {
  const result = resolveRouteCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "has-a-slug",
    id: "cuid-internal-id-should-not-appear",
    publicBase: "https://mamago.by",
  });
  assert.ok(!result.includes("cuid-internal-id-should-not-appear"));
  assert.equal(result, "https://mamago.by/routes/has-a-slug");
}

function testFallsBackToIdOnlyWhenNoSlugAtAll() {
  const result = resolveRouteCanonicalUrl({
    seoCanonicalUrl: null,
    slug: null,
    id: "route-no-slug",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/routes/route-no-slug");
}

function testEmptyStringStoredCanonicalTreatedAsAbsent() {
  const result = resolveRouteCanonicalUrl({
    seoCanonicalUrl: "   ",
    slug: "real-slug",
    id: "route-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/routes/real-slug");
}

function testInvalidStoredCanonicalFallsBackToSlug() {
  for (const seoCanonicalUrl of [
    "not a url",
    "/routes/relative",
    "javascript:alert(1)",
    "http://mamago.local:3000/routes/stale-local-host",
    "https://mamago.by/routes/different-route",
    "https://mamago.by/minsk/routes/real-slug",
    "https://mamago.by/routes/real-slug?preview=1",
  ]) {
    const result = resolveRouteCanonicalUrl({
      seoCanonicalUrl,
      slug: "real-slug",
      id: "route-1",
      publicBase: "https://mamago.by/",
    });
    assert.equal(result, "https://mamago.by/routes/real-slug");
  }
}

function testNonPublicRoutesDoNotGetCanonical() {
  const common = {
    seoCanonicalUrl: "https://mamago.by/routes/real-slug",
    slug: "real-slug",
    id: "route-1",
    publicBase: "https://mamago.by",
  };
  assert.equal(
    resolvePublicRouteCanonicalUrl({ ...common, status: "DRAFT", visibility: "PUBLIC" }),
    undefined,
  );
  assert.equal(
    resolvePublicRouteCanonicalUrl({ ...common, status: "PUBLISHED", visibility: "UNLISTED" }),
    undefined,
  );
  assert.equal(
    resolvePublicRouteCanonicalUrl({ ...common, status: "PUBLISHED", visibility: "PUBLIC" }),
    "https://mamago.by/routes/real-slug",
  );
}

testStoredCanonicalPreferred();
testFallsBackToSlugWhenNoStoredCanonical();
testNeverUsesIdWhenSlugExists();
testFallsBackToIdOnlyWhenNoSlugAtAll();
testEmptyStringStoredCanonicalTreatedAsAbsent();
testInvalidStoredCanonicalFallsBackToSlug();
testNonPublicRoutesDoNotGetCanonical();

console.log("resolveRouteCanonicalUrl tests: OK");
