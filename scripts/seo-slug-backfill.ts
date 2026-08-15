/**
 * SEO-stable slug backfill/report for Place, Event (Activity), Offer, and a
 * GLOBAL/CITY/UNKNOWN scope report for Article.
 *
 * Local-DB only by default (`localhost:5433/mamago2`) — the same
 * fail-closed `assertMigrationDatabaseTarget` gate as the Phoenix
 * importers. PROD requires `--confirm-production` on top of
 * `--confirm-writes`. This is not a Phoenix/WordPress importer — it never
 * touches SSH or a live WordPress source, only the app's own Postgres DB.
 *
 * `article` is always report-only, in both --preview and --confirm-writes:
 * this script never assigns `Article.geoScope`/`cityId` — there is no
 * deterministic per-article signal to auto-classify GLOBAL vs CITY (the
 * WordPress import pipeline deliberately leaves both null; see
 * `classifyArticleScope`), and guessing would violate the "don't default
 * to the launch city" rule. Its own editor review flow
 * (`PublicationGeoScopeField`) is the only place that ever sets it.
 *
 * Preview (no writes, default):
 *   pnpm seo:slug-backfill --preview
 *   pnpm seo:slug-backfill --preview --entities place,offer
 *
 * Write (assigns missing slugs via the existing production code path —
 * `assign*SlugIfMissing()`, idempotent, never touches an already-set
 * slug):
 *   pnpm seo:slug-backfill --confirm-writes
 *   pnpm seo:slug-backfill --confirm-writes --confirm-production   # PROD, once authorized
 */
import { PrismaClient } from "@prisma/client";

import { classifyArticleScope } from "../src/lib/seo/classifyArticleScope";
import { generateActivitySlugFromTitle, assignActivitySlugIfMissing } from "../src/lib/slug/activitySlugService";
import { generateOfferSlugFromTitle, assignOfferSlugIfMissing } from "../src/lib/slug/offerSlugService";
import { generatePlaceSlug, assignPlaceSlugIfMissing, type PlaceForSlug } from "../src/lib/slug/placeSlugService";
import { assertMigrationDatabaseTarget } from "../src/lib/migration/runtime/migrationDatabaseTarget";

export const SEO_SLUG_BACKFILL_ENTITIES = ["place", "event", "offer", "article"] as const;
export type SeoSlugBackfillEntity = (typeof SEO_SLUG_BACKFILL_ENTITIES)[number];

interface Args {
  preview: boolean;
  confirmWrites: boolean;
  confirmProduction: boolean;
  entities: ReadonlySet<SeoSlugBackfillEntity>;
  limit?: number;
}

export function parseSeoSlugBackfillArgs(argv: readonly string[]): Args {
  const preview = argv.includes("--preview");
  const confirmWrites = argv.includes("--confirm-writes");
  if (preview === confirmWrites) throw new Error("Choose exactly one of --preview or --confirm-writes.");

  const entitiesIndex = argv.indexOf("--entities");
  const rawEntities = entitiesIndex >= 0 ? argv[entitiesIndex + 1]?.split(",").map((e) => e.trim()).filter(Boolean) : undefined;
  const entities = new Set<SeoSlugBackfillEntity>((rawEntities ?? [...SEO_SLUG_BACKFILL_ENTITIES]) as SeoSlugBackfillEntity[]);
  for (const entity of entities) {
    if (!(SEO_SLUG_BACKFILL_ENTITIES as readonly string[]).includes(entity)) {
      throw new Error(`Unknown entity "${entity}". Expected one of: ${SEO_SLUG_BACKFILL_ENTITIES.join(", ")}.`);
    }
  }
  if (entities.size === 0) throw new Error("--entities must not be empty.");

  const limitIndex = argv.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : undefined;
  if (limitIndex >= 0 && (!Number.isFinite(limit) || (limit ?? 0) <= 0)) throw new Error("Invalid --limit.");

  return {
    preview,
    confirmWrites,
    confirmProduction: argv.includes("--confirm-production"),
    entities,
    limit,
  };
}

async function queryCurrentDatabase(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  return rows[0]?.current_database ?? "";
}

interface RowReport {
  id: string;
  title: string;
  cityId: string | null;
  proposedSlug?: string;
  inBatchCollision?: boolean;
  outcome: "PROPOSED" | "ASSIGNED" | "SKIPPED_EXISTING" | "ERROR";
  error?: string;
}

async function runPlace(prisma: PrismaClient, args: Args): Promise<RowReport[]> {
  const places = await prisma.place.findMany({
    where: { slug: null },
    select: { id: true, title: true, cityId: true, formattedAddr: true, customAddress: true, shortAddress: true },
    take: args.limit,
    orderBy: { id: "asc" },
  });
  const reports: RowReport[] = [];
  const seenByCity = new Map<string, Set<string>>();
  for (const place of places) {
    try {
      if (args.confirmWrites) {
        const slug = await assignPlaceSlugIfMissing(place.id, place.title);
        reports.push({ id: place.id, title: place.title, cityId: place.cityId, proposedSlug: slug, outcome: "ASSIGNED" });
        continue;
      }
      const proposed = await generatePlaceSlug({ ...place, slug: null } satisfies PlaceForSlug);
      const cityKey = place.cityId ?? "__no_city__";
      const seen = seenByCity.get(cityKey) ?? new Set<string>();
      const inBatchCollision = seen.has(proposed);
      seen.add(proposed);
      seenByCity.set(cityKey, seen);
      reports.push({ id: place.id, title: place.title, cityId: place.cityId, proposedSlug: proposed, inBatchCollision, outcome: "PROPOSED" });
    } catch (error) {
      reports.push({ id: place.id, title: place.title, cityId: place.cityId, outcome: "ERROR", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return reports;
}

async function runEvent(prisma: PrismaClient, args: Args): Promise<RowReport[]> {
  const activities = await prisma.activity.findMany({
    where: { slug: null, type: "EVENT" },
    select: { id: true, title: true, cityId: true },
    take: args.limit,
    orderBy: { id: "asc" },
  });
  const reports: RowReport[] = [];
  const seenByCity = new Map<string, Set<string>>();
  for (const activity of activities) {
    try {
      if (args.confirmWrites) {
        const slug = await assignActivitySlugIfMissing(activity.id, activity.title);
        reports.push({ id: activity.id, title: activity.title, cityId: activity.cityId, proposedSlug: slug, outcome: "ASSIGNED" });
        continue;
      }
      const proposed = await generateActivitySlugFromTitle(activity.title, activity.cityId, activity.id);
      const cityKey = activity.cityId ?? "__no_city__";
      const seen = seenByCity.get(cityKey) ?? new Set<string>();
      const inBatchCollision = seen.has(proposed);
      seen.add(proposed);
      seenByCity.set(cityKey, seen);
      reports.push({ id: activity.id, title: activity.title, cityId: activity.cityId, proposedSlug: proposed, inBatchCollision, outcome: "PROPOSED" });
    } catch (error) {
      reports.push({ id: activity.id, title: activity.title, cityId: activity.cityId, outcome: "ERROR", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return reports;
}

async function runOffer(prisma: PrismaClient, args: Args): Promise<RowReport[]> {
  const offers = await prisma.offer.findMany({
    where: { slug: null },
    select: { id: true, title: true, cityId: true },
    take: args.limit,
    orderBy: { id: "asc" },
  });
  const reports: RowReport[] = [];
  const seenByCity = new Map<string, Set<string>>();
  for (const offer of offers) {
    try {
      if (args.confirmWrites) {
        const slug = await assignOfferSlugIfMissing(offer.id, offer.title);
        reports.push({ id: offer.id, title: offer.title, cityId: offer.cityId, proposedSlug: slug, outcome: "ASSIGNED" });
        continue;
      }
      const proposed = await generateOfferSlugFromTitle(offer.title, offer.cityId, offer.id);
      const cityKey = offer.cityId ?? "__no_city__";
      const seen = seenByCity.get(cityKey) ?? new Set<string>();
      const inBatchCollision = seen.has(proposed);
      seen.add(proposed);
      seenByCity.set(cityKey, seen);
      reports.push({ id: offer.id, title: offer.title, cityId: offer.cityId, proposedSlug: proposed, inBatchCollision, outcome: "PROPOSED" });
    } catch (error) {
      reports.push({ id: offer.id, title: offer.title, cityId: offer.cityId, outcome: "ERROR", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return reports;
}

interface ArticleScopeReport {
  globalCount: number;
  cityCounts: Record<string, number>;
  unknownCount: number;
  unknownIds: string[];
  noSlugCount: number;
}

async function runArticleScopeReport(prisma: PrismaClient): Promise<ArticleScopeReport> {
  const articles = await prisma.article.findMany({
    select: { id: true, geoScope: true, cityId: true, slug: true, city: { select: { slug: true } } },
  });
  const report: ArticleScopeReport = { globalCount: 0, cityCounts: {}, unknownCount: 0, unknownIds: [], noSlugCount: 0 };
  for (const article of articles) {
    if (!article.slug) report.noSlugCount += 1;
    const classification = classifyArticleScope(article);
    if (classification.scope === "GLOBAL") {
      report.globalCount += 1;
    } else if (classification.scope === "CITY") {
      const key = article.city?.slug ?? classification.cityId;
      report.cityCounts[key] = (report.cityCounts[key] ?? 0) + 1;
    } else {
      report.unknownCount += 1;
      report.unknownIds.push(article.id);
    }
  }
  return report;
}

async function main(): Promise<void> {
  const args = parseSeoSlugBackfillArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const currentDatabase = await queryCurrentDatabase(prisma);
    assertMigrationDatabaseTarget({
      databaseUrl: process.env.DATABASE_URL,
      confirmProduction: args.confirmProduction,
      confirmWrites: args.confirmWrites,
      currentDatabase,
      requireProdUserAcknowledgement: false,
    });

    const mode = args.confirmWrites ? "WRITE" : "PREVIEW";

    if (args.entities.has("place")) {
      const rows = await runPlace(prisma, args);
      for (const row of rows) console.log(JSON.stringify({ entity: "place", mode, ...row }));
      console.log(JSON.stringify({ entity: "place", mode, complete: true, count: rows.length, errors: rows.filter((r) => r.outcome === "ERROR").length, collisions: rows.filter((r) => r.inBatchCollision).length }));
    }

    if (args.entities.has("event")) {
      const rows = await runEvent(prisma, args);
      for (const row of rows) console.log(JSON.stringify({ entity: "event", mode, ...row }));
      console.log(JSON.stringify({ entity: "event", mode, complete: true, count: rows.length, errors: rows.filter((r) => r.outcome === "ERROR").length, collisions: rows.filter((r) => r.inBatchCollision).length }));
    }

    if (args.entities.has("offer")) {
      const rows = await runOffer(prisma, args);
      for (const row of rows) console.log(JSON.stringify({ entity: "offer", mode, ...row }));
      console.log(JSON.stringify({ entity: "offer", mode, complete: true, count: rows.length, errors: rows.filter((r) => r.outcome === "ERROR").length, collisions: rows.filter((r) => r.inBatchCollision).length }));
    }

    if (args.entities.has("article")) {
      // Always report-only — see file-level doc comment.
      const report = await runArticleScopeReport(prisma);
      console.log(JSON.stringify({ entity: "article", mode: "REPORT_ONLY", ...report }));
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("seo-slug-backfill.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
