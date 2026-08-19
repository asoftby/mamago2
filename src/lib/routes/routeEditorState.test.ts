import assert from "node:assert/strict";
import test from "node:test";
import { AgePolicy } from "@prisma/client";
import {
  makeEmptyRouteEditorStop,
  mapPersistedRouteAgeToEditorState,
} from "./routeEditorState";

test("ADULT_ONLY hydrates without ordinary or child tags", () => {
  assert.deepEqual(
    mapPersistedRouteAgeToEditorState({
      agePolicy: AgePolicy.ADULT_ONLY,
      ageTags: [],
    }),
    { agePolicy: AgePolicy.ADULT_ONLY, ageTags: [] },
  );
  assert.doesNotThrow(() => makeEmptyRouteEditorStop("test-empty-stop"));
});

test("ordinary 18+ remains SPECIFIC during hydration", () => {
  assert.deepEqual(
    mapPersistedRouteAgeToEditorState({
      agePolicy: AgePolicy.SPECIFIC,
      ageTags: ["18+"],
    }),
    { agePolicy: AgePolicy.SPECIFIC, ageTags: ["18+"] },
  );
});

test("unrestricted and normal specific states reopen unchanged", () => {
  assert.deepEqual(
    mapPersistedRouteAgeToEditorState({
      agePolicy: AgePolicy.UNRESTRICTED,
      ageTags: [],
    }),
    { agePolicy: AgePolicy.UNRESTRICTED, ageTags: [] },
  );
  assert.deepEqual(
    mapPersistedRouteAgeToEditorState({
      agePolicy: AgePolicy.SPECIFIC,
      ageTags: ["5-7"],
    }),
    { agePolicy: AgePolicy.SPECIFIC, ageTags: ["5-7"] },
  );
});
