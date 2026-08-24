/**
 * formatAgeTagsCompact() — shared compact age-range formatter used by both
 * Stories (src/server/stories/loadPublicStoryCollections.ts) and the public
 * event page (src/lib/event/buildEventPageDataFromPrisma.ts). A regression
 * here silently breaks age display in both places, so it gets its own suite.
 *
 * Run: tsx src/lib/config/ages.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { formatAgeTagsCompact } from "./ages";

test("full contiguous run through 18+ collapses to N+", () => {
  assert.equal(
    formatAgeTagsCompact(["5-7", "7-9", "9-12", "12-14", "14-16", "16-18", "18+"]),
    "5+",
  );
});

test("contiguous partial run collapses to a min–max range", () => {
  assert.equal(formatAgeTagsCompact(["5-7", "7-9", "9-12", "12-14"]), "5–14 лет");
});

test("single category keeps its own label", () => {
  assert.equal(formatAgeTagsCompact(["5-7"]), "5–7 лет");
});

test("non-contiguous selection is never collapsed to min–max", () => {
  const result = formatAgeTagsCompact(["3-5", "9-12"]);
  assert.notEqual(result, "3–12 лет");
  // Safe enumeration instead — every selected category still legible.
  assert.equal(result, "3–5 лет, 9–12 лет");
});

test("non-contiguous selection ignores input order", () => {
  assert.equal(formatAgeTagsCompact(["9-12", "3-5"]), formatAgeTagsCompact(["3-5", "9-12"]));
});

test("full 0…18+ coverage uses the existing universal-age semantics", () => {
  assert.equal(
    formatAgeTagsCompact([
      "0-1", "1-3", "3-5", "5-7", "7-9", "9-12", "12-14", "14-16", "16-18", "18+",
    ]),
    "Любой возраст",
  );
});

test("unrecognized age tag is dropped, not thrown or shown verbatim", () => {
  assert.equal(formatAgeTagsCompact(["not-a-real-key"]), undefined);
});

test("unrecognized age tag mixed with valid tags is dropped, valid ones still format", () => {
  assert.equal(formatAgeTagsCompact(["5-7", "not-a-real-key"]), "5–7 лет");
});

test('legacy "18" alias normalizes to canonical "18+" before formatting', () => {
  // Live DB audit (2026-08-24): Activity "interaktivnyy-kvest-mir-naoschup"
  // carries ageTags ["14-16","16-18","18"] — a leftover from a non-canonical
  // Event Wizard chip soft-deactivated by
  // scripts/data-migrations/20260804-upsert-canonical-age-signal-options.ts.
  assert.equal(formatAgeTagsCompact(["14-16", "16-18", "18"]), "14+");
});

test('legacy "18" alone is treated as "18+"', () => {
  assert.equal(formatAgeTagsCompact(["18"]), "18+");
});

test('legacy "18" completes full universal-age coverage the same as canonical "18+"', () => {
  assert.equal(
    formatAgeTagsCompact(["0-1", "1-3", "3-5", "5-7", "7-9", "9-12", "12-14", "14-16", "16-18", "18"]),
    "Любой возраст",
  );
});

test("empty array returns undefined (safe fallback upstream)", () => {
  assert.equal(formatAgeTagsCompact([]), undefined);
});

test("undefined/null input returns undefined (safe fallback upstream)", () => {
  assert.equal(formatAgeTagsCompact(undefined), undefined);
  assert.equal(formatAgeTagsCompact(null), undefined);
});

test("duplicate tags do not affect the result", () => {
  assert.equal(formatAgeTagsCompact(["5-7", "5-7", "7-9"]), formatAgeTagsCompact(["5-7", "7-9"]));
});
