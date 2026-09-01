/**
 * Data-consistency regression coverage for Phase 2A priority recovery data.
 *
 * Validates:
 * - Matrix shape (total count, action breakdown, geo breakdown)
 * - All positions unique and sequential
 * - Each entry has required fields
 * - Legacy source paths match wp-redirect-map.json entries
 * - Expected canonical paths are valid
 * - BLOCKED_OWNER_REVIEW rows are documented
 *
 * Run: pnpm exec tsx src/lib/seo/phase2aPriorityRecovery.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PHASE_2A_PRIORITY_RECOVERIES,
  validatePhase2AIntegrity,
  summarizePhase2A,
  entriesByReadiness,
  entriesByOwnerReviewBatch,
} from "./phase2aPriorityRecovery";

interface WpRedirectMapRecord {
  source: string;
  destination: string;
  permanent: boolean;
  type: string;
  clicks: number;
  confidence: string;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const wpRedirectMap: WpRedirectMapRecord[] = JSON.parse(
  readFileSync(join(repoRoot, "scripts", "data", "wp-redirect-map.json"), "utf8"),
);

function testMatrixShape() {
  // Expect exactly 52 entries (the P2-A batch)
  assert.equal(
    PHASE_2A_PRIORITY_RECOVERIES.length,
    52,
    `P2-A must have 52 entries, got ${PHASE_2A_PRIORITY_RECOVERIES.length}`,
  );

  const summary = summarizePhase2A();
  assert.equal(summary.total, 52);

  // Verify no integrity errors
  const errors = validatePhase2AIntegrity();
  assert.equal(
    errors.length,
    0,
    `Integrity errors: ${errors.join("; ")}`,
  );

  // Verify every entry has a position
  const allPositions = PHASE_2A_PRIORITY_RECOVERIES.map((e) => e.position).sort((a, b) => a - b);
  assert.deepEqual(
    allPositions,
    Array.from({ length: 52 }, (_, i) => i + 1),
    "positions must be 1-52 sequential",
  );
}

function testRequiredFields() {
  for (const entry of PHASE_2A_PRIORITY_RECOVERIES) {
    assert.ok(entry.legacySourcePath, `position ${entry.position}: missing legacySourcePath`);
    assert.ok(entry.currentDestination, `position ${entry.position}: missing currentDestination`);
    assert.ok(entry.currentSlug, `position ${entry.position}: missing currentSlug`);
    assert.ok(entry.entityType, `position ${entry.position}: missing entityType`);
    assert.ok(typeof entry.gscClicks === "number" && entry.gscClicks > 0,
      `position ${entry.position}: invalid gscClicks: ${entry.gscClicks}`);
    assert.ok(
      ["RESTORE_EXISTING_CONTENT", "SEMANTIC_REDIRECT", "UPDATE_RECURRING_OR_SEASONAL", "MANUAL_REVIEW"].includes(entry.action),
      `position ${entry.position}: invalid action: ${entry.action}`,
    );
    assert.ok(
      ["READY_AUTOMATED", "READY_WITH_EXACT_MAPPING", "BLOCKED_OWNER_REVIEW"].includes(entry.readiness),
      `position ${entry.position}: invalid readiness: ${entry.readiness}`,
    );
    assert.ok(entry.evidence, `position ${entry.position}: missing evidence`);
  }
}

function testLegacySourceExistsInRedirectMap() {
  for (const entry of PHASE_2A_PRIORITY_RECOVERIES) {
    const mapEntry = wpRedirectMap.find((row) => row.source === entry.legacySourcePath);
    assert.ok(
      mapEntry,
      `position ${entry.position}: legacy source "${entry.legacySourcePath}" not found in wp-redirect-map.json`,
    );
  }
}

function testActionBreakdown() {
  const summary = summarizePhase2A();

  // Articles: RESTORE_EXISTING_CONTENT
  const restoreCount = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.action === "RESTORE_EXISTING_CONTENT",
  ).length;
  assert.equal(summary.actionBreakdown["RESTORE_EXISTING_CONTENT"], restoreCount);
  assert.ok(restoreCount >= 20, `expected >=20 RESTORE_EXISTING_CONTENT articles, got ${restoreCount}`);

  // Events: SEMANTIC_REDIRECT + UPDATE_RECURRING_OR_SEASONAL
  const redirectCount = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.action === "SEMANTIC_REDIRECT",
  ).length;
  const recurringCount = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.action === "UPDATE_RECURRING_OR_SEASONAL",
  ).length;
  assert.ok(redirectCount >= 5, `expected >=5 SEMANTIC_REDIRECT, got ${redirectCount}`);
  assert.ok(recurringCount >= 10, `expected >=10 UPDATE_RECURRING_OR_SEASONAL, got ${recurringCount}`);
}

function testReadinessBreakdown() {
  const summary = summarizePhase2A();
  const allReady = entriesByReadiness("READY_AUTOMATED");
  const allReadyMapping = entriesByReadiness("READY_WITH_EXACT_MAPPING");
  const allBlocked = entriesByReadiness("BLOCKED_OWNER_REVIEW");

  assert.equal(
    summary.readinessBreakdown["READY_AUTOMATED"],
    allReady.length,
  );
  assert.equal(
    summary.readinessBreakdown["READY_WITH_EXACT_MAPPING"],
    allReadyMapping.length,
  );
  assert.equal(
    summary.readinessBreakdown["BLOCKED_OWNER_REVIEW"],
    allBlocked.length,
  );

  // BLOCKED_OWNER_REVIEW must be a subset of the 52, not additional
  assert.ok(allBlocked.length <= 5, `BLOCKED_OWNER_REVIEW must be <=5, got ${allBlocked.length}`);
}

function testBlockedRowsHaveOwnerReviewBatch() {
  const blocked = entriesByReadiness("BLOCKED_OWNER_REVIEW");
  for (const entry of blocked) {
    assert.ok(entry.ownerReviewBatch, `position ${entry.position}: BLOCKED row missing ownerReviewBatch`);
    assert.ok(
      ["p2a-non-minsk-cities", "p2a-ambiguous-scope", "p2a-event-semantic-destination"].includes(entry.ownerReviewBatch ?? ""),
      `position ${entry.position}: unexpected ownerReviewBatch: ${entry.ownerReviewBatch}`,
    );
  }
}

function testNonMinskCityScopeArticles() {
  // Articles about non-Minsk locations should be BLOCKED_OWNER_REVIEW
  const grodnoArticle = PHASE_2A_PRIORITY_RECOVERIES.find(
    (e) => e.legacySourcePath === "/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
  );
  assert.ok(grodnoArticle, "Grodno article must be in P2-A");
  assert.equal(grodnoArticle?.readiness, "BLOCKED_OWNER_REVIEW");

  const molodechnoArticle = PHASE_2A_PRIORITY_RECOVERIES.find(
    (e) => e.legacySourcePath === "/akvapark-v-molodechno-i-vkusnjushhshhshhie-burgery",
  );
  assert.ok(molodechnoArticle, "Molodechno article must be in P2-A");
  assert.equal(molodechnoArticle?.readiness, "BLOCKED_OWNER_REVIEW");
}

function testGeoScopeCITYArticlesHaveCitySlug() {
  const cityArticles = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.geoScope === "CITY" && e.readiness === "READY_AUTOMATED",
  );
  for (const entry of cityArticles) {
    assert.equal(entry.citySlug, "minsk", `position ${entry.position}: CITY article must have citySlug=minsk`);
  }
}

function testExpectedTravelPaths() {
  // Verify READY_AUTOMATED CITY articles have valid expected canonical paths
  const readyCityArticles = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.geoScope === "CITY" && e.readiness === "READY_AUTOMATED" && e.entityType === "article",
  );
  for (const entry of readyCityArticles) {
    const expectedPath = `/minsk/blog/${entry.currentSlug}`;
    assert.equal(
      entry.currentDestination,
      expectedPath,
      `position ${entry.position}: currentDestination must be ${expectedPath}, got ${entry.currentDestination}`,
    );
  }
}

function testNoGenericMinskFallback() {
  // Verify no READY_AUTOMATED article redirects to a generic /minsk fallback
  const readyArticles = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.readiness === "READY_AUTOMATED" && e.entityType === "article",
  );
  for (const entry of readyArticles) {
    assert.ok(
      !entry.currentDestination.endsWith("/minsk") && !entry.currentDestination.endsWith("/minsk/"),
      `position ${entry.position}: article must not redirect to generic /minsk`,
    );
    // Must redirect to /minsk/blog/{slug}
    assert.ok(
      entry.currentDestination.startsWith("/minsk/blog/"),
      `position ${entry.position}: expected /minsk/blog/ prefix, got ${entry.currentDestination}`,
    );
  }
}

function testEventSemanticRedirectDestination() {
  // Events classified SEMANTIC_REDIRECT must have current destination in /minsk/events/
  const redirectEvents = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.action === "SEMANTIC_REDIRECT" && e.readiness === "READY_WITH_EXACT_MAPPING",
  );
  for (const entry of redirectEvents) {
    assert.ok(
      entry.currentDestination.startsWith("/minsk/events/"),
      `position ${entry.position}: SEMANTIC_REDIRECT event must have /minsk/events/ destination, got ${entry.currentDestination}`,
    );
  }
}

function testOwnerReviewBatches() {
  const batches = new Set(
    PHASE_2A_PRIORITY_RECOVERIES.filter((e) => e.ownerReviewBatch).map((e) => e.ownerReviewBatch),
  );

  // Verify each batch has at least 1 entry
  for (const batch of batches) {
    const batchEntries = entriesByOwnerReviewBatch(batch!);
    assert.ok(batchEntries.length >= 1, `batch "${batch}" must have at least 1 entry`);
  }
}

// === RUN ===
testMatrixShape();
testRequiredFields();
testLegacySourceExistsInRedirectMap();
testActionBreakdown();
testReadinessBreakdown();
testBlockedRowsHaveOwnerReviewBatch();
testNonMinskCityScopeArticles();
testGeoScopeCITYArticlesHaveCitySlug();
testExpectedTravelPaths();
testNoGenericMinskFallback();
testEventSemanticRedirectDestination();
testOwnerReviewBatches();

console.log("phase2aPriorityRecovery.test.ts: PASS");