/** Production-safe canonical media migration. Default mode is read-only. */
import { writeFile } from "node:fs/promises";
import type { MediaEntityType } from "@prisma/client";
import { prismaBase } from "../../src/lib/prisma";
import { isProductionAppEnv } from "../../src/lib/config/productionEnvGuard";
import { parseMigrationDatabaseUrl, PROD_DATABASE_NAME } from "../../src/lib/migration/runtime/migrationDatabaseTarget";
import { buildCanonicalNamingDryRun } from "../../src/server/media/mediaCanonicalPolicy";
import {
  applyCanonicalNamingRows,
  countCanonicalActions,
  filterCanonicalRows,
  type CanonicalApplyReport,
} from "../../src/server/media/mediaCanonicalMigration";

type Args = {
  apply: boolean;
  allowProduction: boolean;
  report?: string;
  limit?: number;
  mediaId?: string;
  entityType?: MediaEntityType;
  entityId?: string;
};

function value(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseCanonicalCliArgs(argv: string[]): Args {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) throw new Error("Choose either --dry-run or --apply");
  const rawLimit = value(argv, "--limit");
  const limit = rawLimit ? Number(rawLimit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit must be a positive integer");
  const rawType = value(argv, "--entity-type")?.toUpperCase();
  const allowed = ["ARTICLE", "EVENT", "PLACE", "ROUTE", "OFFER"];
  if (rawType && !allowed.includes(rawType)) throw new Error(`Unsupported --entity-type: ${rawType}`);
  return {
    apply,
    allowProduction: argv.includes("--allow-production"),
    report: value(argv, "--report"),
    limit,
    mediaId: value(argv, "--media-id"),
    entityType: rawType as MediaEntityType | undefined,
    entityId: value(argv, "--entity-id") ?? value(argv, "--article-id"),
  };
}

export function assertCanonicalEnvironment(input: {
  databaseUrl?: string;
  currentDatabase: string;
  apply: boolean;
  allowProduction: boolean;
}) {
  if (!input.databaseUrl) throw new Error("DATABASE_URL is required");
  const parsed = parseMigrationDatabaseUrl(input.databaseUrl);
  if (parsed.database !== input.currentDatabase) throw new Error("Connected database does not match DATABASE_URL");
  const production = parsed.database === PROD_DATABASE_NAME || isProductionAppEnv();
  if (input.apply && production && !input.allowProduction) {
    throw new Error("Production apply requires explicit --allow-production");
  }
  if (input.allowProduction && !production) {
    throw new Error("--allow-production is refused for a non-production target");
  }
  return { production, database: parsed.database, hostname: parsed.hostname, port: parsed.port };
}

async function persistReport(path: string | undefined, report: unknown) {
  if (path) await writeFile(path, JSON.stringify(report, null, 2));
}

async function main() {
  const args = parseCanonicalCliArgs(process.argv.slice(2));
  const [{ currentDatabase }] = await prismaBase.$queryRaw<Array<{ currentDatabase: string }>>`
    SELECT current_database() AS "currentDatabase"
  `;
  const environment = assertCanonicalEnvironment({
    databaseUrl: process.env.DATABASE_URL,
    currentDatabase,
    apply: args.apply,
    allowProduction: args.allowProduction,
  });
  const policy = await buildCanonicalNamingDryRun();
  const rows = filterCanonicalRows(policy.rows, args);
  if (!args.apply) {
    const report = {
      mode: "dry-run", environment, totalAssets: policy.audit.assets.length,
      examined: rows.length, byAction: countCanonicalActions(rows),
      unresolvedReferences: policy.audit.unresolved, rows,
    };
    await persistReport(args.report, report);
    console.log(JSON.stringify(report));
    return;
  }
  let report: CanonicalApplyReport;
  try {
    report = await applyCanonicalNamingRows(rows);
  } catch (error) {
    const failed = error as Error & { report?: CanonicalApplyReport };
    await persistReport(args.report, failed.report ?? { mode: "apply", error: failed.message });
    throw error;
  }
  const post = await buildCanonicalNamingDryRun();
  const output = {
    ...report,
    environment,
    postApply: {
      totalAssets: post.audit.assets.length,
      unresolvedReferences: post.audit.unresolved,
      byAction: countCanonicalActions(post.rows),
    },
  };
  await persistReport(args.report, output);
  console.log(JSON.stringify(output));
}

if (process.argv[1]?.endsWith("backfill-media-canonical-names.ts")) {
  main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prismaBase.$disconnect());
}
