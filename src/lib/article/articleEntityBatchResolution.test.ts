import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The resolver transitively imports server-only modules and cannot be loaded by
// this plain tsx harness. Keep the regression at the server wiring boundary,
// matching other route/resolver architecture tests in this repository.
const source = readFileSync("src/lib/article/articleMvpRenderData.ts", "utf8");

assert.match(source, /async function loadBasicActivityCards/);
assert.match(source, /prisma\.activity\.findMany/);
assert.match(source, /prisma\.route\.findMany/);
assert.match(source, /prisma\.article\.findMany/);
assert.match(source, /Promise\.all\(\[/, "independent entity batches should load concurrently");
assert.match(source, /new Map<string, Promise<ResolvedOfferEmbedCard \| ResolvedActivityCard \| null>>/);
assert.match(source, /offerCards\.get\(key\)/, "duplicate OFFER references should reuse their pending result");
assert.match(source, /prefetched\.get\(`\$\{b\.entityType\}:\$\{b\.entityId\}`\)/, "resolved cards should be mapped back by type and id");

console.log("articleEntityBatchResolution.test.ts: OK");
