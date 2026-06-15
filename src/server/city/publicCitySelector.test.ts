/**
 * Run: pnpm exec tsx src/server/city/publicCitySelector.test.ts
 */
import assert from "node:assert/strict";
import { isCityNameAllowed } from "@/server/geo/city-resolver";

/** Mirrors publicCitySelector filter — region-like names must not pass. */
function wouldAppearInSelector(row: {
  name: string;
  slug: string;
  isActive: boolean;
  isVisibleInCityFilter: boolean;
  eventsCount: number;
  placesCount: number;
}): boolean {
  const ADMIN_PATTERNS = [/oblast$/i, /-oblast/i, /region$/i];
  const isAdminSlug = ADMIN_PATTERNS.some((p) => p.test(row.slug));
  return (
    row.isActive &&
    row.isVisibleInCityFilter &&
    (row.eventsCount > 0 || row.placesCount > 0) &&
    isCityNameAllowed(row.name) &&
    !isAdminSlug
  );
}

assert.equal(
  wouldAppearInSelector({
    name: "Минская область",
    slug: "minskaya-oblast",
    isActive: true,
    isVisibleInCityFilter: true,
    eventsCount: 10,
    placesCount: 5,
  }),
  false,
);

assert.equal(
  wouldAppearInSelector({
    name: "Марьина Горка",
    slug: "marina-gorka",
    isActive: true,
    isVisibleInCityFilter: true,
    eventsCount: 1,
    placesCount: 0,
  }),
  true,
);

console.log("✅ publicCitySelector.test.ts — all assertions passed");
