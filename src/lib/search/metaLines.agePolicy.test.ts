import assert from "node:assert/strict";
import test from "node:test";
import { resolveActivityAgeLabel } from "./metaLines";

test("Search metadata renders strict adult-only as compact 18+", () => {
  assert.equal(resolveActivityAgeLabel({ agePolicy: "ADULT_ONLY", ageTags: [], ageMinMonths: null, ageMaxMonths: null }), "18+");
});

test("UNKNOWN is never rendered as unrestricted", () => {
  assert.notEqual(resolveActivityAgeLabel({ agePolicy: "UNKNOWN", ageTags: [], ageMinMonths: null, ageMaxMonths: null }), "Любой возраст");
});
