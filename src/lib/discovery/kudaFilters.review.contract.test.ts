import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { matchesManualAgeRanges } from "./audienceEligibility";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("adult and unrestricted audience facets follow the actual discovery grid eligibility", () => {
  const adult = [{ id: "18+", min: 18, max: 99 }];
  const child = [{ id: "3-5", min: 3, max: 5 }];
  assert.equal(matchesManualAgeRanges({ agePolicy: "UNRESTRICTED", ageFrom: 0, ageTo: 12 }, adult), true);
  assert.equal(matchesManualAgeRanges({ agePolicy: "UNKNOWN", ageFrom: 0, ageTo: 99 }, child), false);
  assert.equal(matchesManualAgeRanges({ agePolicy: "SPECIFIC", ageFrom: 0, ageTo: 18 }, adult), false);
  assert.equal(matchesManualAgeRanges({ agePolicy: "ADULT_ONLY", ageFrom: 18, ageTo: 99 }, child), false);
  const facets = source("../../app/api/discovery/events/facets/route.ts");
  assert.match(facets, /matchesManualAgeRanges\(/);
});

test("selected facets remain visible and removable even when there are zero matches", () => {
  const modal = source("../../components/discovery/EventAdvancedFilters.tsx");
  for (const key of ["draft.categories.includes", "draft.genres.includes", "draft.format === option.value", "draft.free"]) {
    assert.ok(modal.includes(key), key);
  }
  const age = source("../../components/site/header/search-segments/AgePanel.tsx");
  assert.match(age, /applied\.age\.includes\(group\.value\)/);
});

test("family selection never silently activates discovery filters or leaks ID in URL", () => {
  const sync = source("../../components/family/FamilyDerivedAgeSync.tsx");
  assert.doesNotMatch(sync, /useEffect\s*\(/);
  assert.doesNotMatch(sync, /setDraft\s*\(/);
  assert.doesNotMatch(sync, /searchParams\.get\("profile"\)/);
});
