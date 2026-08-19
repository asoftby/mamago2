import assert from "node:assert/strict";
import test from "node:test";
import { defaultFilters } from "@/features/filters/discovery/filters.store";
import type { ActivityMock } from "@/types/activity";
import { partitionDiscoveryFeed } from "./partitionDiscoveryFeed";

function activity(id: string, agePolicy: ActivityMock["agePolicy"], ageFrom: number, ageTo: number): ActivityMock {
  return { id, agePolicy, ageFrom, ageTo, type: "EVENT_FIXED", title: id, description: id, image: "/x.jpg", currency: "BYN", tags: [], engagementScore: 10 };
}

test("child context excludes ADULT_ONLY before fallback and keeps unrestricted", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5"] },
    [activity("adult", "ADULT_ONLY", 18, 99), activity("any", "UNRESTRICTED", 0, 99)],
  );
  assert.deepEqual(result.primary.map((item) => item.id), ["any"]);
  assert.equal(result.secondary.some((item) => item.id === "adult"), false);
});

test("ordinary SPECIFIC 18+ remains an age bucket, not strict adult-only", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [activity("specific-18", "SPECIFIC", 18, 99), activity("strict", "ADULT_ONLY", 18, 99)],
  );
  assert.deepEqual(result.primary.map((item) => item.id).sort(), ["specific-18", "strict"]);
});
