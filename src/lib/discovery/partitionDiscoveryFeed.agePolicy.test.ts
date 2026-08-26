import assert from "node:assert/strict";
import test from "node:test";
import { defaultFilters } from "@/features/filters/discovery/filters.store";
import type { ActivityMock } from "@/types/activity";
import { partitionDiscoveryFeed } from "./partitionDiscoveryFeed";

function activity(
  id: string,
  agePolicy: ActivityMock["agePolicy"],
  ageFrom: number,
  ageTo: number,
  engagementScore = 10,
): ActivityMock {
  return {
    id,
    agePolicy,
    ageFrom,
    ageTo,
    type: "EVENT_FIXED",
    title: id,
    description: id,
    image: "/x.jpg",
    currency: "BYN",
    tags: [],
    engagementScore,
  };
}

test("child context excludes ADULT_ONLY before fallback and keeps unrestricted", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5"] },
    [
      activity("adult", "ADULT_ONLY", 18, 99),
      activity("any", "UNRESTRICTED", 0, 12),
    ],
  );
  assert.deepEqual(result.primary.map((item) => item.id), ["any"]);
  assert.equal(result.secondary.some((item) => item.id === "adult"), false);
});

test("adult self context treats unrestricted and adult content as compatible", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [
      activity("unrestricted", "UNRESTRICTED", 0, 12),
      activity("specific-18", "SPECIFIC", 18, 99),
      activity("strict", "ADULT_ONLY", 18, 99),
      activity("kids", "SPECIFIC", 3, 7),
    ],
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["specific-18", "strict", "unrestricted"],
  );
  assert.deepEqual(result.secondary.map((item) => item.id), ["kids"]);
});

test("ordinary SPECIFIC 18+ remains an age bucket, not strict adult-only", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [activity("specific-18", "SPECIFIC", 18, 99), activity("strict", "ADULT_ONLY", 18, 99)],
  );
  assert.deepEqual(result.primary.map((item) => item.id).sort(), ["specific-18", "strict"]);
});

test("no matching audience does not fall back to the unfiltered primary feed", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [activity("kids", "SPECIFIC", 3, 7, 3)],
  );

  assert.deepEqual(result.primary, []);
  assert.deepEqual(result.secondary, []);
});

test("popular secondary requires meaningful engagement", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [
      activity("one-detail-open", "SPECIFIC", 3, 7, 2),
      activity("saved", "SPECIFIC", 5, 9, 4),
    ],
  );

  assert.deepEqual(result.secondary.map((item) => item.id), ["saved"]);
  assert.equal(result.secondaryHeading, "Популярное у других семей");
});
