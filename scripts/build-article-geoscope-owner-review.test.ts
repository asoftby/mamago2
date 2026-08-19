/**
 * Validates the generated owner-review artifacts against the NDJSON
 * source: 107/107 mapping, unique IDs, every row has a recommendation/
 * confidence/reason, and the auto-resolved 9-row CSV + source NDJSON are
 * untouched by the generator (read-only inputs).
 *
 * Run: pnpm tsx scripts/build-article-geoscope-owner-review.test.ts
 * (run scripts/build-article-geoscope-owner-review.ts first to regenerate).
 */
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "docs/migration/reviews/article-geoscope-source-2026-08-15.ndjson";
const AUTO_PATH = "docs/migration/reviews/article-geoscope-auto-2026-08-15.csv";
const CSV_PATH = "docs/migration/reviews/article-geoscope-owner-review-2026-08-15.csv";
const SUMMARY_PATH = "docs/migration/reviews/article-geoscope-summary-2026-08-15.json";

function parseCsv(text: string): string[][] {
  // Fields in this generator's output only ever need `"`-quoting for
  // commas/quotes/newlines — a minimal RFC4180-ish parser is enough here.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

const sourceLines = fs.readFileSync(SOURCE_PATH, "utf8").trim().split("\n");
const sourceRecs = sourceLines.map((l) => JSON.parse(l) as { legacyPostId: number; targetArticleId: string });
assert.equal(sourceRecs.length, 107, "source NDJSON must have exactly 107 rows");

const csvRows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
const header = csvRows[0];
const dataRows = csvRows.slice(1);
assert.equal(dataRows.length, 107, "owner-review CSV must have exactly 107 data rows");

const col = (name: string) => header.indexOf(name);
const legacyIdCol = col("legacyId");
const targetIdCol = col("targetArticleId");
const scopeCol = col("recommendedScope");
const cityCol = col("recommendedCity");
const confCol = col("confidence");
const reasonCol = col("reason");
const ownerDecisionCol = col("ownerDecision");
for (const name of ["legacyId", "targetArticleId", "title", "slug", "legacyUrl", "recommendedScope", "recommendedCity", "confidence", "reason", "specialFlag", "ownerDecision", "ownerCity", "ownerNote"]) {
  assert.ok(header.includes(name), `CSV header must include column "${name}"`);
}

// 107/107 mapping: every source legacyPostId appears exactly once in the CSV.
const sourceIds = new Set(sourceRecs.map((r) => r.legacyPostId));
const csvIds = dataRows.map((r) => Number(r[legacyIdCol]));
assert.equal(new Set(csvIds).size, 107, "legacyId must be unique across all 107 rows");
assert.equal(csvIds.filter((id) => !sourceIds.has(id)).length, 0, "every CSV legacyId must exist in the source NDJSON");
assert.equal([...sourceIds].filter((id) => !csvIds.includes(id)).length, 0, "every source legacyPostId must appear in the CSV");

const csvTargetIds = dataRows.map((r) => r[targetIdCol]);
assert.equal(new Set(csvTargetIds).size, 107, "targetArticleId must be unique across all 107 rows");

for (const r of dataRows) {
  assert.ok(["CITY_MINSK", "GLOBAL", "UNCLEAR"].includes(r[scopeCol]), `row ${r[legacyIdCol]} has an invalid recommendedScope`);
  assert.ok(["HIGH", "MEDIUM", "LOW"].includes(r[confCol]), `row ${r[legacyIdCol]} has an invalid confidence`);
  assert.ok(r[reasonCol] && r[reasonCol].length > 5, `row ${r[legacyIdCol]} is missing a reason`);
  assert.equal(r[ownerDecisionCol], "", `row ${r[legacyIdCol]} ownerDecision must start empty — this task never writes a decision`);
  if (r[scopeCol] === "CITY_MINSK") assert.equal(r[cityCol], "minsk", `CITY_MINSK row ${r[legacyIdCol]} must have recommendedCity=minsk`);
  else assert.equal(r[cityCol], "", `${r[scopeCol]} row ${r[legacyIdCol]} must have empty recommendedCity`);
}

// AMBIGUOUS WP 23812 must be present and explicitly flagged, never silently dropped.
const row23812 = dataRows.find((r) => r[legacyIdCol] === "23812");
assert.ok(row23812, "legacy post 23812 (AMBIGUOUS WP) must be present in the owner review");

// The 9 auto-resolved rows and the 107-row source are read-only inputs —
// this generator must never modify them.
const autoCsv = fs.readFileSync(AUTO_PATH, "utf8");
const autoRows = parseCsv(autoCsv).slice(1);
assert.equal(autoRows.length, 9, "auto-resolved CSV must still have exactly 9 rows (untouched)");

// Summary must record the owner-review result and agree with the CSV counts.
const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"));
assert.ok(summary.ownerReviewResult, "summary JSON must have an ownerReviewResult section");
assert.equal(summary.ownerReviewResult.ownerReviewTotal, 107);
const scopeCounts: Record<string, number> = {};
for (const r of dataRows) scopeCounts[r[scopeCol]] = (scopeCounts[r[scopeCol]] ?? 0) + 1;
assert.deepEqual(summary.ownerReviewResult.recommendations, {
  CITY_MINSK: scopeCounts.CITY_MINSK ?? 0,
  GLOBAL: scopeCounts.GLOBAL ?? 0,
  UNCLEAR: scopeCounts.UNCLEAR ?? 0,
});

console.log("build-article-geoscope-owner-review validation: OK (107/107 mapped, all fields present, auto-9 untouched)");
