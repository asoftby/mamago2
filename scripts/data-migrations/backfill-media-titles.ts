/** MediaAsset.title ownership backfill. Default mode is read-only dry-run. */
import { prismaBase } from "../../src/lib/prisma";
import { assertCanonicalEnvironment, parseCanonicalCliArgs } from "./backfill-media-canonical-names";
import {
  applyMediaTitleBackfillRows,
  buildMediaTitleBackfillDryRun,
  persistMediaTitleReport,
} from "../../src/server/media/mediaTitleBackfill";

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

  const dryRun = await buildMediaTitleBackfillDryRun({
    mediaId: args.mediaId,
    limit: args.limit,
  });

  if (!args.apply) {
    const report = { ...dryRun, environment };
    await persistMediaTitleReport(args.report, report);
    console.log(JSON.stringify(report));
    return;
  }

  const applyReport = await applyMediaTitleBackfillRows(dryRun.rows);
  const output = { ...applyReport, environment };
  await persistMediaTitleReport(args.report, output);
  console.log(JSON.stringify(output));
}

if (process.argv[1]?.endsWith("backfill-media-titles.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prismaBase.$disconnect());
}
