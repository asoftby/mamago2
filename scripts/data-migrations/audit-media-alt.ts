/**
 * Read-only MediaAsset.alt audit. Never writes alt.
 *
 * Usage:
 *   set -a; source .env; set +a; npx tsx scripts/data-migrations/audit-media-alt.ts --report path.json
 */
import { writeFile } from "node:fs/promises";
import { prismaBase } from "../../src/lib/prisma";
import { assertCanonicalEnvironment } from "./backfill-media-canonical-names";

type AltUsageRow = {
  mediaId: string;
  entityType: string;
  field: string;
  altEmpty: boolean;
};

function value(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main() {
  const reportPath = value(process.argv.slice(2), "--report");
  const [{ currentDatabase }] = await prismaBase.$queryRaw<Array<{ currentDatabase: string }>>`
    SELECT current_database() AS "currentDatabase"
  `;
  const environment = assertCanonicalEnvironment({
    databaseUrl: process.env.DATABASE_URL,
    currentDatabase,
    apply: false,
    allowProduction: false,
  });

  const [total, altEmptyTotal, altNonEmptyTotal, usages] = await Promise.all([
    prismaBase.mediaAsset.count({ where: { deletedAt: null } }),
    prismaBase.mediaAsset.count({
      where: { deletedAt: null, OR: [{ alt: null }, { alt: "" }] },
    }),
    prismaBase.mediaAsset.count({
      where: { deletedAt: null, NOT: { OR: [{ alt: null }, { alt: "" }] } },
    }),
    prismaBase.mediaUsage.findMany({
      select: {
        mediaId: true,
        entityType: true,
        field: true,
        media: { select: { alt: true } },
      },
    }),
  ]);

  const usedMediaIds = new Set(usages.map((u) => u.mediaId));
  const usedRows: AltUsageRow[] = [];
  const seenMedia = new Set<string>();
  for (const usage of usages) {
    if (seenMedia.has(usage.mediaId)) continue;
    seenMedia.add(usage.mediaId);
    usedRows.push({
      mediaId: usage.mediaId,
      entityType: usage.entityType,
      field: usage.field,
      altEmpty: !usage.media.alt?.trim(),
    });
  }

  // Prefer first usage field per media for field breakdown via all usages
  const byEntityType: Record<string, { total: number; altEmpty: number; altNonEmpty: number }> = {};
  const byField: Record<string, { total: number; altEmpty: number; altNonEmpty: number }> = {};

  const bump = (
    map: Record<string, { total: number; altEmpty: number; altNonEmpty: number }>,
    key: string,
    empty: boolean,
  ) => {
    const row = map[key] ?? { total: 0, altEmpty: 0, altNonEmpty: 0 };
    row.total += 1;
    if (empty) row.altEmpty += 1;
    else row.altNonEmpty += 1;
    map[key] = row;
  };

  // Distinct media × primary usage (first MediaUsage by createdAt isn't available here;
  // count each distinct media once under each of its entityTypes/fields via unique pairs)
  const mediaEntitySeen = new Set<string>();
  const mediaFieldSeen = new Set<string>();
  for (const usage of usages) {
    const empty = !usage.media.alt?.trim();
    const ek = `${usage.mediaId}:${usage.entityType}`;
    if (!mediaEntitySeen.has(ek)) {
      mediaEntitySeen.add(ek);
      bump(byEntityType, usage.entityType, empty);
    }
    const fieldKey = usage.field || "(null)";
    const fk = `${usage.mediaId}:${fieldKey}`;
    if (!mediaFieldSeen.has(fk)) {
      mediaFieldSeen.add(fk);
      bump(byField, fieldKey, empty);
    }
  }

  const usedAltEmpty = usedRows.filter((r) => r.altEmpty).length;
  const usedAltNonEmpty = usedRows.length - usedAltEmpty;

  const contextHints = {
    ARTICLE: [
      "article title (context only — not a copy-paste alt)",
      "surrounding paragraph / block text near the image",
      "existing caption if curated later",
      "cover vs inline vs seo field role",
    ],
    PLACE: [
      "place title + image kind (logo vs gallery)",
      "category / subcategory",
      "caption if present",
    ],
    EVENT: [
      "event title",
      "cover vs gallery field",
      "shortDesc / description scene cues",
    ],
    ROUTE: ["route title", "stop title for stop-gallery images", "cover vs gallery/stop field"],
    OFFER: ["offer title", "related place / business name", "cover vs gallery field"],
  };

  const report = {
    mode: "alt-audit-readonly",
    environment,
    totals: {
      mediaAssetTotal: total,
      altEmptyTotal,
      altNonEmptyTotal,
      usedMediaDistinct: usedMediaIds.size,
      usedAltEmpty,
      usedAltNonEmpty,
    },
    byEntityType,
    byField,
    contextHints,
    note: "No alt values were written. Do not set alt = entity.title massively.",
  };

  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

if (process.argv[1]?.endsWith("audit-media-alt.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prismaBase.$disconnect());
}
