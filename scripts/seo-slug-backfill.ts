/**
 * SEO-stable slug backfill/report for Place, Event (Activity), Offer, and a
 * GLOBAL/CITY/UNKNOWN scope report for Article.
 *
 * Final canonical paths (owner-confirmed contract, 2026-08-15):
 *   Place:  /{city}/places/{slug}
 *   Event:  /{city}/events/{slug}
 *   Offer:  /{city}/offers/{slug}          (no {section} — see BACKLOG-116)
 *   Article (GLOBAL): /blog/{slug}
 *   Article (CITY):   /{city}/blog/{slug}
 *   Route:  /routes/{slug}                 (unchanged, out of scope here)
 *
 * Place/Event/Offer are all city-scoped (`@@unique([cityId, slug])`), so a
 * row with no resolvable city cannot get a `finalCanonicalPath` at all —
 * reported as `outcome: "UNRESOLVED"` / `unresolvedReason: "NO_CITY"`
 * rather than guessed. See
 * `docs/migration/seo/final-url-architecture-2026-08-15.md`.
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
import { buildCityPublicPath } from "../src/lib/routing/cityPaths";
import { getOfferPublicPath } from "../src/lib/offers/offerPublicUrl";
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
  citySlug: string | null;
  currentSlug: string | null;
  proposedSlug?: string;
  /** The final permanent public path this row will resolve at, once slugged — null when unresolved (no city). */
  finalCanonicalPath: string | null;
  inBatchCollision?: boolean;
  unresolvedReason?: "NO_CITY";
  outcome: "PROPOSED" | "ASSIGNED" | "SKIPPED_EXISTING" | "UNRESOLVED" | "ERROR";
  error?: string;
}

async function runPlace(prisma: PrismaClient, args: Args): Promise<RowReport[]> {
  const places = await prisma.place.findMany({
    where: { slug: null },
    select: {
      id: true,
      title: true,
      cityId: true,
      formattedAddr: true,
      customAddress: true,
      shortAddress: true,
      city: { select: { slug: true } },
    },
    take: args.limit,
    orderBy: { id: "asc" },
  });
  const reports: RowReport[] = [];
  const seenByCity = new Map<string, Set<string>>();
  for (const place of places) {
    const citySlug = place.city?.slug ?? null;
    const base = { id: place.id, title: place.title, cityId: place.cityId, citySlug, currentSlug: null as string | null };
    if (!citySlug) {
      // Place has no city — see docs/migration/seo/final-url-architecture-2026-08-15.md §2.
      // No canonical path can be proposed until a city is assigned.
      reports.push({ ...base, finalCanonicalPath: null, unresolvedReason: "NO_CITY", outcome: "UNRESOLVED" });
      continue;
    }
    try {
      if (args.confirmWrites) {
        const slug = await assignPlaceSlugIfMissing(place.id, place.title);
        reports.push({ ...base, proposedSlug: slug, finalCanonicalPath: buildCityPublicPath({ citySlug, type: "place", slug }), outcome: "ASSIGNED" });
        continue;
      }
      const proposed = await generatePlaceSlug({ ...place, slug: null } satisfies PlaceForSlug);
      const cityKey = place.cityId ?? "__no_city__";
      const seen = seenByCity.get(cityKey) ?? new Set<string>();
      const inBatchCollision = seen.has(proposed);
      seen.add(proposed);
      seenByCity.set(cityKey, seen);
      reports.push({ ...base, proposedSlug: proposed, finalCanonicalPath: buildCityPublicPath({ citySlug, type: "place", slug: proposed }), inBatchCollision, outcome: "PROPOSED" });
    } catch (error) {
      reports.push({ ...base, finalCanonicalPath: null, outcome: "ERROR", error: error instanceof Error ? error.message : String(error) });
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
  // Activity.cityId has no Prisma relation to City (bare FK-shaped
  // column) — resolve city slugs with a single batched lookup instead.
  const cityIds = [...new Set(activities.map((a) => a.cityId).filter((id): id is string => Boolean(id)))];
  const cities = cityIds.length > 0 ? await prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, slug: true } }) : [];
  const citySlugByCityId = new Map(cities.map((c) => [c.id, c.slug]));

  const reports: RowReport[] = [];
  const seenByCity = new Map<string, Set<string>>();
  for (const activity of activities) {
    const citySlug = (activity.cityId && citySlugByCityId.get(activity.cityId)) ?? null;
    const base = { id: activity.id, title: activity.title, cityId: activity.cityId, citySlug, currentSlug: null as string | null };
    if (!citySlug) {
      reports.push({ ...base, finalCanonicalPath: null, unresolvedReason: "NO_CITY", outcome: "UNRESOLVED" });
      continue;
    }
    try {
      if (args.confirmWrites) {
        const slug = await assignActivitySlugIfMissing(activity.id, activity.title);
        reports.push({ ...base, proposedSlug: slug, finalCanonicalPath: `/${citySlug}/events/${slug}`, outcome: "ASSIGNED" });
        continue;
      }
      const proposed = await generateActivitySlugFromTitle(activity.title, activity.cityId, activity.id);
      const cityKey = activity.cityId ?? "__no_city__";
      const seen = seenByCity.get(cityKey) ?? new Set<string>();
      const inBatchCollision = seen.has(proposed);
      seen.add(proposed);
      seenByCity.set(cityKey, seen);
      reports.push({ ...base, proposedSlug: proposed, finalCanonicalPath: `/${citySlug}/events/${proposed}`, inBatchCollision, outcome: "PROPOSED" });
    } catch (error) {
      reports.push({ ...base, finalCanonicalPath: null, outcome: "ERROR", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return reports;
}

async function runOffer(prisma: PrismaClient, args: Args): Promise<RowReport[]> {
  const offers = await prisma.offer.findMany({
    where: { slug: null },
    select: { id: true, title: true, cityId: true, city: { select: { slug: true } } },
    take: args.limit,
    orderBy: { id: "asc" },
  });
  const reports: RowReport[] = [];
  const seenByCity = new Map<string, Set<string>>();
  for (const offer of offers) {
    const citySlug = offer.city?.slug ?? null;
    const base = { id: offer.id, title: offer.title, cityId: offer.cityId, citySlug, currentSlug: null as string | null };
    if (!citySlug) {
      // Offer.cityId is unset — see BACKLOG-114. No canonical path can be
      // proposed until the Offer (or its Place) has a resolvable city.
      reports.push({ ...base, finalCanonicalPath: null, unresolvedReason: "NO_CITY", outcome: "UNRESOLVED" });
      continue;
    }
    try {
      if (args.confirmWrites) {
        const slug = await assignOfferSlugIfMissing(offer.id, offer.title);
        reports.push({ ...base, proposedSlug: slug, finalCanonicalPath: getOfferPublicPath({ slug }, citySlug), outcome: "ASSIGNED" });
        continue;
      }
      const proposed = await generateOfferSlugFromTitle(offer.title, offer.cityId, offer.id);
      const cityKey = offer.cityId ?? "__no_city__";
      const seen = seenByCity.get(cityKey) ?? new Set<string>();
      const inBatchCollision = seen.has(proposed);
      seen.add(proposed);
      seenByCity.set(cityKey, seen);
      reports.push({ ...base, proposedSlug: proposed, finalCanonicalPath: getOfferPublicPath({ slug: proposed }, citySlug), inBatchCollision, outcome: "PROPOSED" });
    } catch (error) {
      reports.push({ ...base, finalCanonicalPath: null, outcome: "ERROR", error: error instanceof Error ? error.message : String(error) });
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
    const summarize = (entity: string, rows: RowReport[]) => {
      for (const row of rows) console.log(JSON.stringify({ entity, mode, ...row }));
      console.log(JSON.stringify({
        entity,
        mode,
        complete: true,
        count: rows.length,
        errors: rows.filter((r) => r.outcome === "ERROR").length,
        collisions: rows.filter((r) => r.inBatchCollision).length,
        unresolved: rows.filter((r) => r.outcome === "UNRESOLVED").length,
      }));
    };

    if (args.entities.has("place")) summarize("place", await runPlace(prisma, args));
    if (args.entities.has("event")) summarize("event", await runEvent(prisma, args));
    if (args.entities.has("offer")) summarize("offer", await runOffer(prisma, args));

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
