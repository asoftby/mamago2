/**
 * Static contract for server-side publish rights (no DB in this harness).
 * Запуск: npx tsx "src/app/api/admin/articles/[id]/submit/route.contract.test.ts"
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const submit = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const moderate = readFileSync(new URL("../moderate/route.ts", import.meta.url), "utf8");

for (const [name, src] of [["submit", submit], ["moderate", moderate]] as const) {
  assert.match(src, /requireAdminOrModerator\(\)/, `${name}: server-side role guard`);
  assert.match(src, /if \(!user\)[\s\S]*?401/, `${name}: unauthenticated/unauthorized rejected`);
  assert.match(src, /invalidatePublicArticleLists\(\)/, `${name}: public lists refreshed after publish`);
}
// Direct publish is decided on the server from user.role, never from a client flag.
assert.match(submit, /resolveArticleSubmitAction\(user\.role\)/);
assert.match(submit, /action === "publish"[\s\S]*?moderateArticle\(id, "publish"\)[\s\S]*?submitArticleForModeration\(id\)/);
assert.doesNotMatch(submit, /req\.json|body\./, "submit takes no client-provided publish flag");
console.log("articles submit route contract: OK");
