/**
 * Data-consistency regression coverage for the Phase 1B geo recovery
 * matrix: the legacy redirect target for each article in
 * scripts/data/wp-redirect-map.json must respect that article's reviewed
 * geoScope (CITY -> /minsk/blog/{slug}, COUNTRY -> /blog/{slug}).
 * Also validates the audited-state fingerprint fields exist and are
 * self-consistent.
 * Run: pnpm exec tsx src/lib/seo/migratedArticlePublicationGeoRecovery.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES,
  expectedFinalCanonicalPath,
} from "./migratedArticlePublicationGeoRecovery";

interface WpRedirectMapRecord {
  source: string;
  destination: string;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const wpRedirectMap: WpRedirectMapRecord[] = JSON.parse(
  readFileSync(join(repoRoot, "scripts", "data", "wp-redirect-map.json"), "utf8"),
);

function testMatrixShape() {
  assert.equal(MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES.length, 9);
  const cityCount = MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES.filter(
    (r) => r.geoScope === "CITY",
  ).length;
  const countryCount = MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES.filter(
    (r) => r.geoScope === "COUNTRY",
  ).length;
  assert.equal(cityCount, 7);
  assert.equal(countryCount, 2);

  for (const recovery of MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES) {
    if (recovery.geoScope === "CITY") {
      assert.equal(recovery.citySlug, "minsk", `${recovery.articleId} CITY must set citySlug`);
    } else {
      assert.equal(recovery.citySlug, null, `${recovery.articleId} COUNTRY must not set citySlug`);
    }
  }
}

function testAuditedStateFingerprint() {
  for (const recovery of MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES) {
    // expectedUpdatedAt must be a valid ISO-8601 UTC timestamp
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(recovery.expectedUpdatedAt),
      `${recovery.articleId} expectedUpdatedAt must be ISO-8601 UTC with milliseconds: ${recovery.expectedUpdatedAt}`,
    );
    assert.equal(
      recovery.expectedUpdatedAt.endsWith("Z"),
      true,
      `${recovery.articleId} expectedUpdatedAt must be in UTC (ending Z)`,
    );
    // auditedTitle must match matrix title
    assert.equal(
      recovery.auditedTitle,
      recovery.title,
      `${recovery.articleId} auditedTitle must equal matrix title`,
    );
    // auditedPublishedAt must be valid ISO-8601 UTC
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(recovery.auditedPublishedAt),
      `${recovery.articleId} auditedPublishedAt must be ISO-8601 UTC with milliseconds: ${recovery.auditedPublishedAt}`,
    );
    assert.equal(
      typeof recovery.auditedNoindex,
      "boolean",
      `${recovery.articleId} auditedNoindex must be boolean`,
    );
    // blocksCount must be a positive integer
    assert.ok(
      Number.isInteger(recovery.auditedBlocksCount) && recovery.auditedBlocksCount > 0,
      `${recovery.articleId} auditedBlocksCount must be a positive integer, got ${recovery.auditedBlocksCount}`,
    );
  }
}

function testLegacyRedirectTargetRespectsGeoScope() {
  for (const recovery of MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES) {
    const entry = wpRedirectMap.find((row) => row.source === recovery.legacyUrl);
    assert.ok(entry, `expected a wp-redirect-map.json row for ${recovery.legacyUrl}`);
    assert.equal(
      entry!.destination,
      expectedFinalCanonicalPath(recovery),
      `redirect destination for ${recovery.articleId} must match its reviewed geoScope`,
    );
  }
}

function testCountryArticlesUseNationalPath() {
  const countryArticles = MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES.filter(
    (r) => r.geoScope === "COUNTRY",
  );
  assert.equal(countryArticles.length, 2);
  for (const recovery of countryArticles) {
    const path = expectedFinalCanonicalPath(recovery);
    assert.ok(path.startsWith("/blog/"), `${recovery.articleId} COUNTRY path must be national`);
    assert.ok(!path.startsWith("/minsk/"), `${recovery.articleId} COUNTRY path must not be city-scoped`);
  }
}

function testNbspTrailingTitle() {
  const nbspArticle = MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES.find(
    (r) => r.articleId === "cmssu26ev00wcwsobwpy1glg0",
  );
  assert.ok(nbspArticle, "cmssu26ev00wcwsobwpy1glg0 must exist in recovery matrix");

  // The PROD title ends with U+00A0 NO-BREAK SPACE, NOT U+0020 regular space.
  // Verify the recovery fingerprint uses the correct character.
  const expectedNbsp = "\u00A0";
  const regularSpace = " ";

  assert.equal(
    nbspArticle.title.endsWith(expectedNbsp),
    true,
    `cmssu26ev00wcwsobwpy1glg0 title must end with U+00A0 (found last char code: ${nbspArticle.title.charCodeAt(nbspArticle.title.length - 1)})`,
  );
  assert.equal(
    nbspArticle.title.endsWith(regularSpace),
    false,
    "cmssu26ev00wcwsobwpy1glg0 title must NOT end with a regular U+0020 space",
  );

  // Verify auditedTitle matches title (same as testAuditedStateFingerprint does for all)
  assert.equal(
    nbspArticle.auditedTitle,
    nbspArticle.title,
    "cmssu26ev00wcwsobwpy1glg0 auditedTitle must equal title",
  );

  // Prove that a regular space would NOT match — guards against accidental normalization.
  const wrongTitle = nbspArticle.title.slice(0, -1) + regularSpace;
  assert.notEqual(
    wrongTitle,
    nbspArticle.title,
    "U+0020 variant must NOT match U+00A0 fingerprint — normalization guard verified",
  );

  console.log(
    `  [NBSP] articleId=cmssu26ev00wcwsobwpy1glg0 last char=U+${nbspArticle.title.charCodeAt(nbspArticle.title.length - 1).toString(16).toUpperCase().padStart(4, "0")}`,
  );
}

testMatrixShape();
testAuditedStateFingerprint();
testNbspTrailingTitle();
testLegacyRedirectTargetRespectsGeoScope();
testCountryArticlesUseNationalPath();

console.log("migratedArticlePublicationGeoRecovery.test.ts: PASS");
