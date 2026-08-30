/**
 * Regression tests for migrated article legacy redirect recovery.
 * Run: pnpm exec tsx src/lib/seo/migratedArticleSlugRecovery.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRedirectManifest, type AllowedSections } from "./redirectManifest";
import {
  expectedLegacyRedirectDestination,
  MIGRATED_ARTICLE_SLUG_RECOVERIES,
} from "./migratedArticleSlugRecovery";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const wpMap = JSON.parse(
  readFileSync(join(repoRoot, "scripts", "data", "wp-redirect-map.json"), "utf8"),
) as Array<{ source: string; destination: string; permanent: boolean; type: string }>;

const wpBySource = new Map(wpMap.map((row) => [row.source, row]));

assert.equal(
  MIGRATED_ARTICLE_SLUG_RECOVERIES.length,
  11,
  "expected exactly 11 verified migrated article slug recoveries",
);

const totalClicks = MIGRATED_ARTICLE_SLUG_RECOVERIES.reduce(
  (sum, row) => sum + row.gscClicks,
  0,
);
assert.equal(totalClicks, 17527, "historical GSC clicks sum for verified recoveries");

for (const recovery of MIGRATED_ARTICLE_SLUG_RECOVERIES) {
  const rule = wpBySource.get(recovery.legacySourcePath);
  assert.ok(rule, `missing wp redirect for ${recovery.legacySourcePath}`);
  assert.equal(rule.type, "article");
  assert.equal(rule.permanent, true);
  assert.equal(
    rule.destination,
    expectedLegacyRedirectDestination(recovery),
    `wp redirect destination mismatch for ${recovery.legacySourcePath}`,
  );
}

const ALLOWED: AllowedSections = {
  rootSections: ["blog", "places", "offers", "legal", "page", "routes", "ideas", "search"],
  citySections: [
    "activity", "birthday", "blog", "classes", "events", "kuda",
    "offers", "places", "programs", "routes", "tags", "where-to-go",
  ],
};

const { rules, issues } = loadRedirectManifest({
  manifestPath: join(repoRoot, "manifest.csv"),
  require: true,
  minRows: 850,
  allowedSections: ALLOWED,
});

for (const recovery of MIGRATED_ARTICLE_SLUG_RECOVERIES) {
  const rule = rules.find((row) => row.source === recovery.legacySourcePath);
  assert.ok(rule, `manifest redirect missing for ${recovery.legacySourcePath}`);
  assert.equal(rule.permanent, true);
  assert.equal(
    rule.destination,
    expectedLegacyRedirectDestination(recovery),
    `manifest destination mismatch for ${recovery.legacySourcePath}`,
  );
}

assert.equal(issues.length, 0, `manifest issues: ${issues.join("; ")}`);

console.log("migratedArticleSlugRecovery.test.ts: PASS");
