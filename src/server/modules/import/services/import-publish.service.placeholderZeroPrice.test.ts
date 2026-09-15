/**
 * Static wiring check: import-publish.service.ts's MERGE path
 * (mergeImportedRecordIntoActivity) must apply the same placeholder-zero
 * priceFrom exemption as the UPDATE path's filterActivityNonDestructiveUpdates
 * (event-field-mapper.ts). No DB-free unit test exists for the MERGE
 * function itself — it hits prisma.activity.findUnique/update directly and
 * isn't exported — so this asserts on the source the way
 * route.readonlyImportSchedule.test.ts does for a similarly DB-bound route.
 *
 * Regression target (Codex review finding on PR #299): a pre-fix ABWS
 * Activity stored with priceFrom: 0 must be correctable by a later
 * re-import once the non-zero-occurrences fix computes a real floor — both
 * the UPDATE and MERGE code paths must treat that stored 0 as "empty",
 * unless priceMode is FREE (a genuinely free event).
 *
 * Запуск: npx tsx src/server/modules/import/services/import-publish.service.placeholderZeroPrice.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/server/modules/import/services/import-publish.service.ts", "utf8");

assert.match(
  source,
  /import \{\s*\n\s*mapNormalizedToActivity,\s*\n\s*filterActivityNonDestructiveUpdates,\s*\n\s*isPlaceholderZeroPriceFrom,\s*\n\s*\} from "\.\.\/publish\/event-field-mapper";/,
  "must import isPlaceholderZeroPriceFrom alongside the existing event-field-mapper imports",
);

assert.match(
  source,
  /\(fieldName === "priceFrom" &&\s*\n\s*isPlaceholderZeroPriceFrom\(existingActivity as unknown as Record<string, unknown>\)\)/,
  "the MERGE loop's existingIsEmpty check must treat a placeholder-zero priceFrom as empty, same as the UPDATE path",
);

console.log("import-publish.service MERGE placeholder-zero-price wiring test: OK");
