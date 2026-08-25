/** Recover persisted legacy aliases from a canonical apply report. Default is dry-run. */
import { readFile, writeFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { prismaBase } from "../../src/lib/prisma";
import { assertCanonicalEnvironment } from "./backfill-media-canonical-names";
import { buildAliasRecoveryPlan, countAliasRecoveryPlan } from "../../src/server/media/mediaUrlAliasRecovery";
import { normalizeMediaAliasPath } from "../../src/server/media/mediaUrlAlias";

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const allowProduction = argv.includes("--allow-production");
  const value = (flag: string) => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] : undefined; };
  const inputPath = value("--input");
  const reportPath = value("--report");
  if (!inputPath) throw new Error("--input apply-report.json is required");
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const sourceRows = Array.isArray(input.results) ? input.results.filter((row: { action?: string }) => row.action === "renamed") : [];
  const mediaIds = [...new Set(sourceRows.map((row: { mediaId?: string }) => row.mediaId).filter(Boolean))] as string[];
  const [[{ currentDatabase }], assets] = await Promise.all([
    prismaBase.$queryRaw<Array<{ currentDatabase: string }>>`SELECT current_database() AS "currentDatabase"`,
    prismaBase.mediaAsset.findMany({ where: { id: { in: mediaIds } }, select: { id: true, publicUrl: true } }),
  ]);
  const environment = assertCanonicalEnvironment({ databaseUrl: process.env.DATABASE_URL, currentDatabase, apply, allowProduction });
  let aliases: Array<{ mediaId: string; legacyPath: string }> = [];
  let aliasTableAvailable = true;
  const candidatePaths = sourceRows.flatMap((row: { oldUrl?: string; oldFilename?: string }) => {
    const normalized = normalizeMediaAliasPath(row.oldUrl ?? row.oldFilename ?? "");
    return normalized ? [normalized] : [];
  });
  try {
    aliases = await prismaBase.mediaUrlAlias.findMany({
      where: { legacyPath: { in: candidatePaths } },
      select: { mediaId: true, legacyPath: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021" && !apply) {
      aliasTableAvailable = false;
    } else {
      throw error;
    }
  }
  const rows = buildAliasRecoveryPlan({ rows: sourceRows, assets, aliases });
  const counts = countAliasRecoveryPlan(rows);
  let applied: { created: number; expected: number; totalAliases: number } | undefined;
  if (apply) {
    if (!aliasTableAvailable) throw new Error("MediaUrlAlias table is not deployed");
    if (counts.duplicates || counts.conflicts || counts.missingMediaAsset || counts.invalidLegacyPath || counts.unresolved) {
      throw new Error(`Alias repair apply refused: ${JSON.stringify(counts)}`);
    }
    const result = await prismaBase.mediaUrlAlias.createMany({
      data: rows.filter((row) => row.action === "create").map((row) => ({
        mediaId: row.mediaId!, legacyPath: row.legacyPath!, reason: "dev-canonical-recovery", source: inputPath,
      })),
      skipDuplicates: true,
    });
    if (result.count !== counts.aliasesToCreate) {
      throw new Error(`Alias repair apply created ${result.count}; expected ${counts.aliasesToCreate}`);
    }
    const totalAliases = await prismaBase.mediaUrlAlias.count();
    applied = { created: result.count, expected: counts.aliasesToCreate, totalAliases };
  }
  const report = { mode: apply ? "apply" : "dry-run", environment, aliasTableAvailable, inputPath, counts, applied, rows };
  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

if (process.argv[1]?.endsWith("repair-media-url-aliases.ts")) {
  main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prismaBase.$disconnect());
}
