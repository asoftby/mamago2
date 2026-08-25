/**
 * Static wiring checks proving every client caller of /api/save/status
 * actually routes its fetch decision through saveStatusFetchGuard.ts,
 * rather than just having the pure functions exist untested-in-place.
 * Source-text assertions are this repo's established technique for
 * behavior that needs a DOM to exercise directly (no jsdom/RTL — see
 * SaveToPlanModal.test.tsx) — this guards against someone reintroducing an
 * unconditional fetch in one of the six call sites while leaving the guard
 * module itself untouched.
 *
 * Run: npx tsx src/features/save/saveStatusFetchGuardWiring.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const GUARD_IMPORT = /from "@\/features\/save\/saveStatusFetchGuard"/;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

// ── Standalone save-heart components (own-fetch + dedupe) ──────────────────
for (const path of [
  "src/features/save/SaveHeart.tsx",
  "src/features/save/PlaceSaveHeart.tsx",
  "src/features/save/ArticleSaveHeart.tsx",
]) {
  const source = read(path);
  assert.match(source, GUARD_IMPORT, `${path} must import the shared save-status fetch guard`);
  assert.match(source, /shouldFetchOwnSaveStatus\(isAuthenticated\)/, `${path} must gate its fetch on shouldFetchOwnSaveStatus`);
  assert.match(source, /shouldRefetchAfterFlowClose\(/, `${path} must dedupe its post-close refetch via shouldRefetchAfterFlowClose`);
}

// ── Detail-page views with an inline status fetch (own-fetch + dedupe) ─────
for (const path of [
  "src/components/event-page/EventPageView.tsx",
  "src/components/event-page/ConversionEventPageView.tsx",
] as const) {
  const source = read(path);
  assert.match(source, GUARD_IMPORT, `${path} must import the shared save-status fetch guard`);
  assert.match(source, /shouldFetchOwnSaveStatus\(isAuthenticated\)/, `${path} must gate its fetch on shouldFetchOwnSaveStatus`);
  assert.match(source, /shouldRefetchAfterFlowClose\(/, `${path} must dedupe its post-close refetch via shouldRefetchAfterFlowClose`);
}

// ── OfferPageView: single status load, no post-close refetch effect ────────
{
  const source = read("src/components/offers/OfferPageView.tsx");
  assert.match(source, GUARD_IMPORT, "OfferPageView must import the shared save-status fetch guard");
  assert.match(source, /shouldFetchOwnSaveStatus\(isAuthenticated\)/, "OfferPageView must gate its fetch on shouldFetchOwnSaveStatus");
}

console.log("saveStatusFetchGuardWiring.test.ts: OK");
