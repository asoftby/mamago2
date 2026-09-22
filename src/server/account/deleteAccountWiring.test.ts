import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const service = await readFile("src/server/account/deleteAccount.service.ts", "utf8");
  const exportRoute = await readFile("src/app/api/me/export/route.ts", "utf8");
  const canonicalRoute = await readFile("src/app/api/me/delete/route.ts", "utf8");
  const legacyRoute = await readFile("src/app/api/user/delete/route.ts", "utf8");

  assert.match(service, /client\.\$transaction\(async \(tx\) =>/u);
  assert.doesNotMatch(service, /tx\.user\.delete\s*\(/u);
  assert.match(service, /BUSINESS_OWNER_TRANSFER_REQUIRED/u);
  assert.match(service, /LAST_ADMIN/u);
  for (const exportedPersonalData of ["email", "phoneE164", "idea", "planItem"]) {
    assert.match(exportRoute, new RegExp(exportedPersonalData, "u"));
  }
  for (const deletionCoverage of ["email: anonymousEmail", "phoneE164: null", "idea.deleteMany", "planItem.deleteMany"]) {
    assert.match(service, new RegExp(deletionCoverage.replaceAll(".", "\\."), "u"));
  }
  assert.match(canonicalRoute, /handleDeleteOwnAccount/u);
  assert.match(legacyRoute, /handleDeleteOwnAccount/u);
  assert.doesNotMatch(canonicalRoute + legacyRoute, /prisma\.user\.(delete|update)/u);

  console.log("SEC-007 deletion policy wiring tests: OK");
}

main().catch((error) => {
  console.error("SEC-007 deletion policy wiring tests: FAILED", error);
  process.exitCode = 1;
});
