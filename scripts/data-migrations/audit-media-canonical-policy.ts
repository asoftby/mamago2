/** Full read-only reverse-reference and canonical policy audit. */
import prisma from "../../src/lib/prisma";
import { buildCanonicalNamingDryRun } from "../../src/server/media/mediaCanonicalPolicy";

async function main() {
  const { audit, rows } = await buildCanonicalNamingDryRun();
  console.log(JSON.stringify({
    mode: "dry-run",
    totalAssets: audit.assets.length,
    unresolvedReferences: audit.unresolved,
    rows,
  }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
