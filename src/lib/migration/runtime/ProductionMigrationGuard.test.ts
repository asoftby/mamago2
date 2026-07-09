/**
 * Tests for the PRODUCTION-profile migration preflight guard.
 * Run: tsx src/lib/migration/runtime/ProductionMigrationGuard.test.ts (assert-based, project convention).
 *
 * Uses synthetic app-dir and manifest fixtures in a temp dir; never touches
 * the repo's real src/app tree or manifest.csv.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateProductionMigrationGuard } from "./ProductionMigrationGuard";
import { resolveMigrationProfile } from "./MigrationProfile";

const rootDir = mkdtempSync(join(tmpdir(), "production-migration-guard-test-"));

const appDir = join(rootDir, "src", "app");
mkdirSync(join(appDir, "(public)", "blog"), { recursive: true });
mkdirSync(join(appDir, "(public)", "[city]", "events"), { recursive: true });

const validManifestPath = join(rootDir, "manifest-valid.csv");
writeFileSync(
  validManifestPath,
  [
    "rule_type,old_url,new_url,entity_type,entity_id,notes",
    "wp_journal,https://mamago.by/old-post,https://mamago.by/blog/new-post,article,1,",
    "slug_history,https://mamago.by/minsk/old-event,https://mamago.by/minsk/events/new-event,event,2,",
  ].join("\n"),
);

const missingManifestPath = join(rootDir, "does-not-exist.csv");

// Non-PRODUCTION profile: always passes regardless of confirmation/manifest/indexing.

const fullImportProfile = resolveMigrationProfile({ profileName: "FULL_IMPORT" });
const nonProdResult = evaluateProductionMigrationGuard({
  profile: fullImportProfile,
  confirmProduction: false,
  manifestPath: missingManifestPath,
  appDir,
  isIndexingBlocked: () => true,
});
assert.equal(nonProdResult.passed, true);
assert.deepEqual(nonProdResult.issues, []);

// PRODUCTION profile, nothing satisfied: confirmation missing, manifest missing, indexing blocked.

const productionProfile = resolveMigrationProfile({ profileName: "PRODUCTION" });
const allFailResult = evaluateProductionMigrationGuard({
  profile: productionProfile,
  confirmProduction: false,
  manifestPath: missingManifestPath,
  minRedirectRows: 1,
  appDir,
  isIndexingBlocked: () => true,
});
assert.equal(allFailResult.passed, false);
const allFailCodes = allFailResult.issues.map((issue) => issue.code);
assert.ok(allFailCodes.includes("PRODUCTION_CONFIRMATION_MISSING"));
assert.ok(allFailCodes.includes("REDIRECT_MANIFEST_MISSING_FILE"));
assert.ok(allFailCodes.includes("SEO_INDEXING_DISABLED"));

// PRODUCTION profile, everything satisfied: confirmed, valid manifest, indexing enabled.

const allPassResult = evaluateProductionMigrationGuard({
  profile: productionProfile,
  confirmProduction: true,
  manifestPath: validManifestPath,
  minRedirectRows: 2,
  appDir,
  isIndexingBlocked: () => false,
});
assert.equal(allPassResult.passed, true);
assert.deepEqual(allPassResult.issues, []);

// PRODUCTION profile with manifest present but below the row threshold still fails.

const belowThresholdResult = evaluateProductionMigrationGuard({
  profile: productionProfile,
  confirmProduction: true,
  manifestPath: validManifestPath,
  minRedirectRows: 900,
  appDir,
  isIndexingBlocked: () => false,
});
assert.equal(belowThresholdResult.passed, false);
assert.ok(
  belowThresholdResult.issues.some((issue) => issue.code === "REDIRECT_MANIFEST_BELOW_THRESHOLD"),
);

// redirectPolicy.validateManifest === false skips the manifest check entirely, even with a missing file.

const manifestCheckSkippedProfile = {
  ...productionProfile,
  redirectPolicy: { name: "VALIDATE" as const, validateManifest: false, applyRedirects: false },
};
const manifestSkippedResult = evaluateProductionMigrationGuard({
  profile: manifestCheckSkippedProfile,
  confirmProduction: true,
  manifestPath: missingManifestPath,
  appDir,
  isIndexingBlocked: () => false,
});
assert.equal(manifestSkippedResult.passed, true);
assert.deepEqual(manifestSkippedResult.issues, []);

// seoPolicy.requireIndexingEnabled === false skips the indexing check, even when indexing is blocked.

const indexingCheckSkippedProfile = resolveMigrationProfile({
  profileName: "PRODUCTION",
  seoPolicyName: "VALIDATE",
});
const indexingSkippedResult = evaluateProductionMigrationGuard({
  profile: indexingCheckSkippedProfile,
  confirmProduction: true,
  manifestPath: validManifestPath,
  minRedirectRows: 2,
  appDir,
  isIndexingBlocked: () => true,
});
assert.equal(indexingSkippedResult.passed, true);
assert.deepEqual(indexingSkippedResult.issues, []);

rmSync(rootDir, { recursive: true, force: true });

console.log("production migration guard tests: OK");
