import assert from "node:assert/strict";
import test from "node:test";
import { projectOfferAudience } from "./classesDiscoveryFeed";

test("unrestricted offer preserves typed age policy despite numeric fallback", () => {
  assert.deepEqual(
    projectOfferAudience({
      ageMinMonths: null,
      ageMaxMonths: null,
      agePolicy: "UNRESTRICTED",
    }),
    {
      ageFrom: 0,
      ageTo: 18,
      agePolicy: "UNRESTRICTED",
    },
  );
});

test("adult-only offer projects canonical adult bounds", () => {
  assert.deepEqual(
    projectOfferAudience({
      ageMinMonths: null,
      ageMaxMonths: null,
      agePolicy: "ADULT_ONLY",
    }),
    {
      ageFrom: 18,
      ageTo: 99,
      agePolicy: "ADULT_ONLY",
    },
  );
});
