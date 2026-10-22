import assert from "node:assert/strict";
import config from "../../../next.config";

async function main() {
  assert.equal(config.skipTrailingSlashRedirect, true, "automatic slash redirect must not run before exact legacy mappings");
  assert.equal(config.trailingSlash, false, "generated canonical URLs remain without slash");
  const rules = await config.redirects?.();
  assert.ok(rules && rules.length >= 850, "keep the reviewed manifest enabled");
  const top18 = rules.find((rule) => rule.source === "/top-18-kafe-i-restoranov-s-detskoj-ploshhadkoj-ili-komnatoj");
  assert.ok(top18);
  assert.equal(top18.destination, "/minsk/blog/top-18-kafe-i-restoranov-s-detskoy-ploshchadkoy-ili-komnatoy");
  assert.ok(!rules.some((rule) => rule.source === "/:path*"), "no blanket fallback masking missing URLs");
  console.log("Redirect configuration/manifest integration: OK");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
