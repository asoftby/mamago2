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

test("adult self context rejects child ranges ending at 18", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [
      activity("unrestricted", "UNRESTRICTED", 0, 12),
      activity("specific-18", "SPECIFIC", 18, 99),
      activity("strict", "ADULT_ONLY", 18, 99),
      activity("zero-to-18", "SPECIFIC", 0, 18),
      activity("five-to-18", "SPECIFIC", 5, 18),
      activity("sixteen-to-18", "SPECIFIC", 16, 18),
      activity("kids", "SPECIFIC", 3, 7),
    ],
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["specific-18", "strict", "unrestricted"],
  );
  assert.deepEqual(result.secondary, []);
  assert.equal(result.secondaryHeading, null);
});

test("explicit adult matches outrank unrestricted content even with lower engagement", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [
      activity("unrestricted", "UNRESTRICTED", 0, 12, 100),
      activity("adult", "ADULT_ONLY", 18, 99, 4),
    ],
  );

  assert.deepEqual(result.primary.map((item) => item.id), ["adult", "unrestricted"]);
});

test("UNKNOWN age does not become a child match through numeric fallback", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5"] },
    [activity("unknown", "UNKNOWN", 0, 12, 3)],
  );

  assert.deepEqual(result.primary, []);
  assert.deepEqual(result.secondary, []);
});

test("ordinary SPECIFIC 18+ remains adult-compatible without becoming strict ADULT_ONLY", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [activity("specific-18", "SPECIFIC", 18, 99), activity("strict", "ADULT_ONLY", 18, 99)],
  );
  assert.deepEqual(result.primary.map((item) => item.id).sort(), ["specific-18", "strict"]);
});

test("adult plus child context uses child eligibility and does not broaden to 18+", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["5-7", "18+"] },
    [
      activity("strict-adult", "ADULT_ONLY", 18, 99),
      activity("specific-adult", "SPECIFIC", 18, 99),
      activity("kid", "SPECIFIC", 5, 7),
      activity("family", "SPECIFIC", 5, 99),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["family", "kid", "unrestricted"],
  );
  assert.equal(result.primary.some((item) => item.id === "strict-adult"), false);
  assert.equal(result.primary.some((item) => item.id === "specific-adult"), false);
});

test("multiple child buckets must all be compatible with the event", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5", "9-12"] },
    [
      activity("young-only", "SPECIFIC", 3, 5),
      activity("both", "SPECIFIC", 3, 12),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["both", "unrestricted"],
  );
});

test("no matching adult audience does not fall back to child content", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [activity("kids", "SPECIFIC", 3, 7, 10)],
  );

  assert.deepEqual(result.primary, []);
  assert.deepEqual(result.secondary, []);
});

test("popular secondary remains available for child contexts", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5"] },
    [
      activity("one-detail-open", "SPECIFIC", 9, 12, 2),
      activity("saved", "SPECIFIC", 9, 12, 4),
    ],
  );

  assert.deepEqual(result.secondary.map((item) => item.id), ["saved"]);
  assert.equal(result.secondaryHeading, "Популярное у других семей");
});
