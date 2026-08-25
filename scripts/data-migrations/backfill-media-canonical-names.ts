/**
 * Canonical media filename backfill. Safe by default: no flag means --dry-run.
 *
 * Usage:
 *   npx tsx scripts/data-migrations/backfill-media-canonical-names.ts --dry-run
 *   npx tsx scripts/data-migrations/backfill-media-canonical-names.ts --apply --limit 20
 *   npx tsx scripts/data-migrations/backfill-media-canonical-names.ts --media-id <id>
 *   npx tsx scripts/data-migrations/backfill-media-canonical-names.ts --article-id <id>
 */
import prisma from "../../src/lib/prisma";
import {
  canonicalizeArticleMedia,
  canonicalizeMediaAsset,
  type CanonicalizeResult,
} from "../../src/server/media/mediaNaming";
import { buildCanonicalNamingDryRun } from "../../src/server/media/mediaCanonicalPolicy";

type Args = { apply: boolean; limit?: number; mediaId?: string; articleId?: string };

function parseArgs(argv: string[]): Args {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) throw new Error("Choose either --dry-run or --apply");
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const rawLimit = value("--limit");
  const limit = rawLimit ? Number(rawLimit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit must be a positive integer");
  return { apply, limit, mediaId: value("--media-id"), articleId: value("--article-id") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply) {
    throw new Error("--apply is disabled until MediaUsage repair is explicitly approved and completed");
  }
  const policy = await buildCanonicalNamingDryRun();
  let report = policy.rows;
  if (args.mediaId) report = report.filter((row) => row.mediaId === args.mediaId);
  if (args.articleId) report = report.filter((row) => row.entityType === "ARTICLE" && row.entityId === args.articleId);
  if (args.limit) report = report.slice(0, args.limit);
  console.table(report);
  console.log(JSON.stringify({
    examined: report.length,
    mode: "dry-run",
    byAction: Object.fromEntries([...new Set(report.map((row) => row.action))].map((action) => [action, report.filter((row) => row.action === action).length])),
  }));
  return;

  /* Legacy implementation retained temporarily for the future apply engine;
   * unreachable while repair/apply is gated above. */
  console.log(args.apply ? "MODE apply" : "MODE dry-run (default)");
  const articles = await prisma.article.findMany({
    where: {
      ...(args.articleId ? { id: args.articleId } : {}),
    },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
    ...(args.limit ? { take: args.limit } : {}),
  });

  const seen = new Set<string>();
  const rows: Array<CanonicalizeResult & { entityType: string; entityId: string; entityTitle: string }> = [];
  for (const article of articles) {
    const results = await canonicalizeArticleMedia(article.id, { allowPublished: true, dryRun: !args.apply });
    for (const result of results) {
      if (args.mediaId && result.mediaId !== args.mediaId) continue;
      if (seen.has(result.mediaId)) continue;
      seen.add(result.mediaId);
      rows.push({ ...result, entityType: "ARTICLE", entityId: article.id, entityTitle: article.title });
    }
  }

  if (args.mediaId && !seen.has(args.mediaId)) {
    const media = await prisma.mediaAsset.findUnique({ where: { id: args.mediaId } });
    if (media) {
      const result = await canonicalizeMediaAsset({
        mediaId: media.id,
        context: { type: "CONTEXTLESS", createdAt: media.createdAt, unique: media.id.slice(-8) },
        dryRun: !args.apply,
      });
      rows.push({ ...result, entityType: "CONTEXTLESS", entityId: "-", entityTitle: "-" });
    }
  }

  const report = rows.map((row) => ({
    mediaId: row.mediaId,
    oldFilename: row.oldFilename,
    oldUrl: row.oldUrl,
    newFilename: row.newFilename,
    newUrl: row.newUrl,
    usageCount: row.usageCount,
    entityType: row.entityType,
    entityId: row.entityId,
    entityTitle: row.entityTitle,
    action: row.action,
    reason: row.reason,
  }));
  console.table(report);
  const actionable = rows.filter((row) => row.action === "rename" || row.action === "metadata-only").length;
  console.log(JSON.stringify({ examined: rows.length, actionable, mode: args.apply ? "apply" : "dry-run" }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
