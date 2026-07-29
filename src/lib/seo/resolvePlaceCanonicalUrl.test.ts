import assert from "node:assert/strict";
import { resolvePlaceCanonicalUrl } from "./resolvePlaceCanonicalUrl";

function testStoredCanonicalPreferred() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "https://mamago.by/places/stored-canonical",
    slug: "some-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/places/stored-canonical");
}

function testFallsBackToSlugWhenNoStoredCanonical() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "pugovka-na-ratomskoy-7",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/places/pugovka-na-ratomskoy-7");
}

function testNeverUsesIdWhenSlugExists() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    slug: "has-a-slug",
    id: "cuid-internal-id-should-not-appear",
    publicBase: "https://mamago.by",
  });
  assert.ok(!result.includes("cuid-internal-id-should-not-appear"));
  assert.equal(result, "https://mamago.by/places/has-a-slug");
}

function testFallsBackToIdOnlyWhenNoSlugAtAll() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: null,
    slug: null,
    id: "place-no-slug",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/places/place-no-slug");
}

function testEmptyStringStoredCanonicalTreatedAsAbsent() {
  const result = resolvePlaceCanonicalUrl({
    seoCanonicalUrl: "   ",
    slug: "real-slug",
    id: "place-1",
    publicBase: "https://mamago.by",
  });
  assert.equal(result, "https://mamago.by/places/real-slug");
}

testStoredCanonicalPreferred();
testFallsBackToSlugWhenNoStoredCanonical();
testNeverUsesIdWhenSlugExists();
testFallsBackToIdOnlyWhenNoSlugAtAll();
testEmptyStringStoredCanonicalTreatedAsAbsent();

console.log("resolvePlaceCanonicalUrl tests: OK");
