import { existsSync } from "fs";
import { Prisma } from "@prisma/client";
import { prismaBase } from "../src/lib/prisma";
import { SearchIndexerService } from "../src/lib/search/SearchIndexerService";
import { ArticleContentPayloadSchema } from "../src/lib/publications/articleMvp";
import {
  buildLegacyEditorialRouteArticleContent,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_NAME,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_SLUG,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CITY_SLUG,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_COUNTRY_ISO,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SLUG,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SOURCE_KEY,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXPECTED_STOPS,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE,
} from "../src/lib/routes/legacyEditorialRouteArticleMigration";
import {
  assertMigrationDatabaseTarget,
  DEV_DATABASE_NAME,
  LOCAL_GOLDEN_DATABASE_NAME,
  parseMigrationDatabaseUrl,
  PROD_DATABASE_NAME,
} from "../src/lib/migration/runtime/migrationDatabaseTarget";
import { resolveStoredMediaPath } from "../src/server/media/media-storage";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-migration");
const CONFIRM_PRODUCTION = process.argv.includes("--confirm-production");
const EXPECTED_COUNT = LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.length;
const APPROVED_SLUGS = LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.map((item) => item.slug);
const ALL_SOURCE_KEYS = [
  ...LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.map((item) => item.sourceRecordKey),
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SOURCE_KEY,
];

type DatabaseTarget = {
  kind: "LOCAL_GOLDEN" | "DEV" | "PROD";
  urlDatabase: string;
  currentDatabase: string;
};

async function inspectDatabaseTarget(): Promise<DatabaseTarget> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const parsed = parseMigrationDatabaseUrl(databaseUrl);
  const rows = await prismaBase.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDatabase = rows[0]?.current_database ?? "";
  if (!currentDatabase || currentDatabase !== parsed.database) {
    throw new Error(
      `DATABASE_FINGERPRINT_MISMATCH:url=${parsed.database || "<empty>"}:connected=${currentDatabase || "<empty>"}`,
    );
  }

  if (currentDatabase === PROD_DATABASE_NAME) {
    return { kind: "PROD", urlDatabase: parsed.database, currentDatabase };
  }
  if (currentDatabase === DEV_DATABASE_NAME) {
    return { kind: "DEV", urlDatabase: parsed.database, currentDatabase };
  }
  if (currentDatabase === LOCAL_GOLDEN_DATABASE_NAME) {
    assertMigrationDatabaseTarget({
      databaseUrl,
      currentDatabase,
      confirmProduction: false,
      confirmWrites: false,
      requireProdUserAcknowledgement: false,
    });
    return { kind: "LOCAL_GOLDEN", urlDatabase: parsed.database, currentDatabase };
  }

  throw new Error(`DATABASE_TARGET_REFUSED:${currentDatabase}`);
}

function assertApplyDatabaseTarget(target: DatabaseTarget): void {
  if (target.kind !== "PROD") return;
  assertMigrationDatabaseTarget({
    databaseUrl: process.env.DATABASE_URL,
    currentDatabase: target.currentDatabase,
    confirmProduction: CONFIRM_PRODUCTION,
    confirmWrites: true,
    requireProdUserAcknowledgement: false,
  });
}

function sourceStateAllowed(status: string, visibility: string): boolean {
  return (
    (status === "DRAFT" && visibility === "PRIVATE") ||
    (status === "PUBLISHED" && visibility === "PUBLIC") ||
    status === "ARCHIVED"
  );
}

function stableJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]),
    );
  };
  return JSON.stringify(normalize(value));
}

async function inspectState() {
  const databaseTarget = await inspectDatabaseTarget();

  const cityCandidates = await prismaBase.city.findMany({
    where: {
      slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CITY_SLUG,
      country: { isoCode: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_COUNTRY_ISO },
      isActive: true,
      isLegacyNonCity: false,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      countryId: true,
      isActive: true,
      isLegacyNonCity: true,
      country: { select: { isoCode: true } },
    },
    orderBy: { id: "asc" },
    take: 2,
  });
  const city = cityCandidates.length === 1 ? cityCandidates[0] : null;

  const routes = await prismaBase.route.findMany({
    where: {
      slug: { in: [...APPROVED_SLUGS, LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SLUG] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      visibility: true,
      authorId: true,
      cityId: true,
      createdAt: true,
      updatedAt: true,
      seoTitle: true,
      seoDescription: true,
      seoH1: true,
      seoOgTitle: true,
      seoOgDescription: true,
      seoOgImage: true,
      seoRobots: true,
      stops: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          customTitle: true,
          note: true,
          photoUrl: true,
          placeId: true,
          googlePlaceId: true,
          lat: true,
          lng: true,
          address: true,
          priceType: true,
          priceMin: true,
          priceMax: true,
          priceCurrency: true,
          priceNote: true,
        },
      },
    },
    orderBy: { slug: "asc" },
  });

  const routeLineages = await prismaBase.migrationLineage.findMany({
    where: {
      sourceRecordKey: { in: ALL_SOURCE_KEYS },
      targetType: "ROUTE",
      targetRole: "primary",
      isActive: true,
    },
    select: {
      id: true,
      sourceId: true,
      sourceEntityType: true,
      sourceStableKey: true,
      sourceRecordKey: true,
      targetId: true,
      targetNaturalKey: true,
      lastSourceHash: true,
      runId: true,
      recordId: true,
    },
    orderBy: { sourceRecordKey: "asc" },
  });

  const articleLineages = await prismaBase.migrationLineage.findMany({
    where: {
      sourceRecordKey: {
        in: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.map((item) => item.sourceRecordKey),
      },
      targetType: "ARTICLE",
      targetRole: "primary",
    },
    select: {
      id: true,
      sourceId: true,
      sourceRecordKey: true,
      targetId: true,
      isActive: true,
      targetNaturalKey: true,
    },
    orderBy: { sourceRecordKey: "asc" },
  });

  const articles = await prismaBase.article.findMany({
    where: { slug: { in: APPROVED_SLUGS } },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      geoScope: true,
      cityId: true,
      categoryId: true,
      noindex: true,
      publishedAt: true,
      createdAt: true,
      seoTitle: true,
      seoDescription: true,
      contentJson: true,
      category: {
        select: {
          id: true,
          nameRu: true,
          slug: true,
          publicationType: true,
          isActive: true,
          archivedAt: true,
        },
      },
    },
    orderBy: { slug: "asc" },
  });

  const excludedArticles = await prismaBase.article.findMany({
    where: { slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SLUG },
    select: { id: true, slug: true, status: true, cityId: true },
  });
  const excludedArticleLineages = await prismaBase.migrationLineage.findMany({
    where: {
      sourceRecordKey: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SOURCE_KEY,
      targetType: "ARTICLE",
    },
    select: { id: true, targetId: true, isActive: true },
  });

  const targetCategoryCandidates = await prismaBase.eventCategory.findMany({
    where: {
      OR: [
        { nameRu: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_NAME },
        { slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_SLUG },
      ],
    },
    select: {
      id: true,
      nameRu: true,
      slug: true,
      publicationType: true,
      isActive: true,
      archivedAt: true,
    },
    orderBy: { id: "asc" },
  });
  const exactCategories = targetCategoryCandidates.filter(
    (category) =>
      category.nameRu === LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_NAME &&
      category.slug === LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_SLUG &&
      category.publicationType === "ARTICLE",
  );
  const targetCategory = exactCategories.length === 1 ? exactCategories[0] : null;

  const photoUrls = Array.from(
    new Set(
      routes
        .flatMap((route) => route.stops.map((stop) => stop.photoUrl?.trim() ?? ""))
        .filter(Boolean),
    ),
  );
  const mediaAssets = photoUrls.length
    ? await prismaBase.mediaAsset.findMany({
        where: {
          OR: [{ publicUrl: { in: photoUrls } }, { storageKey: { in: photoUrls } }],
        },
        select: {
          id: true,
          status: true,
          filename: true,
          storageKey: true,
          publicUrl: true,
          deletedAt: true,
        },
      })
    : [];

  const problems: string[] = [];
  const warnings: string[] = [];

  if (cityCandidates.length !== 1) problems.push(`TARGET_CITY_COUNT:${cityCandidates.length}/1`);
  if (routes.length !== EXPECTED_COUNT + 1) {
    problems.push(`ROUTE_SCOPE_COUNT:${routes.length}/${EXPECTED_COUNT + 1}`);
  }
  if (routeLineages.length !== EXPECTED_COUNT + 1) {
    problems.push(`ROUTE_LINEAGE_COUNT:${routeLineages.length}/${EXPECTED_COUNT + 1}`);
  }
  if (exactCategories.length > 1) {
    problems.push(`TARGET_CATEGORY_DUPLICATE:${exactCategories.length}`);
  }
  const categoryConflicts = targetCategoryCandidates.filter(
    (category) =>
      !(
        category.nameRu === LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_NAME &&
        category.slug === LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_SLUG &&
        category.publicationType === "ARTICLE"
      ),
  );
  if (categoryConflicts.length > 0) {
    problems.push(`TARGET_CATEGORY_CONFLICT:${categoryConflicts.map((row) => row.id).join(",")}`);
  }

  const excludedRoute = routes.find(
    (route) => route.slug === LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SLUG,
  );
  const excludedLineage = routeLineages.find(
    (lineage) => lineage.sourceRecordKey === LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SOURCE_KEY,
  );
  if (!excludedRoute) problems.push("EXCLUDED_ROUTE_MISSING");
  if (!excludedLineage) problems.push("EXCLUDED_ROUTE_LINEAGE_MISSING");
  if (excludedRoute && excludedLineage?.targetId !== excludedRoute.id) {
    problems.push("EXCLUDED_ROUTE_LINEAGE_TARGET_MISMATCH");
  }
  if (excludedArticles.length > 0 || excludedArticleLineages.length > 0) {
    problems.push(`EXCLUDED_ROUTE_ARTICLE_PRESENT:${excludedArticles.length}/${excludedArticleLineages.length}`);
  }

  const plannedArticles: Array<{
    sourceRecordKey: string;
    sourceId: string;
    sourceEntityType: string;
    sourceStableKey: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
    routeId: string;
    slug: string;
    title: string;
    routeState: string;
    stopCount: number;
    imageCount: number;
    blockCount: number;
    sourceCreatedAt: Date;
    contentJson: ReturnType<typeof buildLegacyEditorialRouteArticleContent>;
    seoTitle: string | null;
    seoDescription: string | null;
    seoH1: string | null;
    seoOgTitle: string | null;
    seoOgDescription: string | null;
    seoOgImage: string | null;
    seoRobots: string | null;
  }> = [];

  let totalStops = 0;
  for (const scopeItem of LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE) {
    const route = routes.find((row) => row.slug === scopeItem.slug);
    const lineage = routeLineages.find((row) => row.sourceRecordKey === scopeItem.sourceRecordKey);
    if (!route) {
      problems.push(`ROUTE_MISSING:${scopeItem.slug}`);
      continue;
    }
    if (!lineage) {
      problems.push(`ROUTE_LINEAGE_MISSING:${scopeItem.sourceRecordKey}`);
      continue;
    }
    if (lineage.targetId !== route.id) {
      problems.push(`ROUTE_LINEAGE_TARGET_MISMATCH:${scopeItem.sourceRecordKey}`);
    }
    if (route.authorId !== null) problems.push(`ROUTE_NOT_EDITORIAL:${scopeItem.slug}`);
    if (!sourceStateAllowed(route.status, route.visibility)) {
      problems.push(`ROUTE_STATE:${scopeItem.slug}:${route.status}/${route.visibility}`);
    }
    if (route.stops.length !== scopeItem.expectedStops) {
      problems.push(`ROUTE_STOPS:${scopeItem.slug}:${route.stops.length}/${scopeItem.expectedStops}`);
    }
    totalStops += route.stops.length;

    const contentStops = route.stops.map((stop) => {
      if (!stop.customTitle?.trim()) problems.push(`STOP_TITLE_EMPTY:${scopeItem.slug}:${stop.order}`);
      if (!stop.note.trim()) problems.push(`STOP_NOTE_EMPTY:${scopeItem.slug}:${stop.order}`);
      const hasUnsupportedStructuredData = Boolean(
        stop.placeId ||
          stop.googlePlaceId ||
          stop.lat != null ||
          stop.lng != null ||
          stop.address?.trim() ||
          stop.priceType !== "UNKNOWN" ||
          stop.priceMin != null ||
          stop.priceMax != null ||
          stop.priceNote?.trim(),
      );
      if (hasUnsupportedStructuredData) {
        problems.push(`STOP_STRUCTURE_CHANGED:${scopeItem.slug}:${stop.order}`);
      }

      const photoUrl = stop.photoUrl?.trim() || null;
      let mediaId: string | null = null;
      if (photoUrl) {
        const matches = mediaAssets.filter(
          (asset) => asset.publicUrl === photoUrl || asset.storageKey === photoUrl,
        );
        const uniqueMatches = Array.from(new Map(matches.map((asset) => [asset.id, asset])).values());
        if (uniqueMatches.length !== 1) {
          problems.push(`PHOTO_MEDIA_MATCH:${scopeItem.slug}:${stop.order}:${uniqueMatches.length}/1`);
        } else {
          const asset = uniqueMatches[0];
          const canonicalPath =
            resolveStoredMediaPath(asset.publicUrl) ?? resolveStoredMediaPath(asset.storageKey);
          if (asset.deletedAt) problems.push(`PHOTO_MEDIA_DELETED:${scopeItem.slug}:${stop.order}`);
          if (asset.status !== "ACTIVE") {
            problems.push(`PHOTO_MEDIA_STATUS:${scopeItem.slug}:${stop.order}:${asset.status}`);
          }
          if (!canonicalPath || !existsSync(canonicalPath)) {
            problems.push(`PHOTO_MEDIA_FILE_MISSING:${scopeItem.slug}:${stop.order}`);
          }
          mediaId = asset.id;
        }
      }

      return {
        order: stop.order,
        customTitle: stop.customTitle ?? "",
        note: stop.note,
        mediaId,
      };
    });

    const contentJson = buildLegacyEditorialRouteArticleContent(scopeItem.sourceRecordKey, contentStops);
    const parsedContent = ArticleContentPayloadSchema.safeParse(contentJson);
    if (!parsedContent.success) problems.push(`CONTENT_SCHEMA_INVALID:${scopeItem.slug}`);

    const imageCount = contentStops.filter((stop) => Boolean(stop.mediaId)).length;
    const expectedBlocks = route.stops.length * 2 + imageCount;
    if (contentJson.blocks.length !== expectedBlocks) {
      problems.push(`CONTENT_BLOCKS:${scopeItem.slug}:${contentJson.blocks.length}/${expectedBlocks}`);
    }

    const sourceHash =
      lineage.lastSourceHash?.trim() || `current-route:${route.id}:${route.updatedAt.toISOString()}`;

    plannedArticles.push({
      sourceRecordKey: scopeItem.sourceRecordKey,
      sourceId: lineage.sourceId,
      sourceEntityType: lineage.sourceEntityType,
      sourceStableKey: lineage.sourceStableKey,
      sourceHash,
      runId: lineage.runId,
      recordId: lineage.recordId,
      routeId: route.id,
      slug: route.slug,
      title: route.title,
      routeState: `${route.status}/${route.visibility}`,
      stopCount: route.stops.length,
      imageCount,
      blockCount: contentJson.blocks.length,
      sourceCreatedAt: route.createdAt,
      contentJson,
      seoTitle: route.seoTitle,
      seoDescription: route.seoDescription,
      seoH1: route.seoH1,
      seoOgTitle: route.seoOgTitle,
      seoOgDescription: route.seoOgDescription,
      seoOgImage: route.seoOgImage,
      seoRobots: route.seoRobots,
    });
  }

  if (totalStops !== LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXPECTED_STOPS) {
    problems.push(`APPROVED_STOPS:${totalStops}/${LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXPECTED_STOPS}`);
  }
  if (plannedArticles.length !== EXPECTED_COUNT) {
    problems.push(`PLANNED_ARTICLES:${plannedArticles.length}/${EXPECTED_COUNT}`);
  }

  const existingMode = articles.length > 0 || articleLineages.length > 0;
  if (existingMode) {
    if (articles.length !== EXPECTED_COUNT) {
      problems.push(`ARTICLE_PARTIAL_COUNT:${articles.length}/${EXPECTED_COUNT}`);
    }
    if (articleLineages.length !== EXPECTED_COUNT) {
      problems.push(`ARTICLE_LINEAGE_PARTIAL_COUNT:${articleLineages.length}/${EXPECTED_COUNT}`);
    }
    for (const planned of plannedArticles) {
      const article = articles.find((row) => row.slug === planned.slug);
      const articleLineage = articleLineages.find(
        (row) => row.sourceRecordKey === planned.sourceRecordKey && row.isActive,
      );
      if (!article) {
        problems.push(`ARTICLE_MISSING:${planned.slug}`);
        continue;
      }
      if (!articleLineage || articleLineage.targetId !== article.id) {
        problems.push(`ARTICLE_LINEAGE_TARGET_MISMATCH:${planned.sourceRecordKey}`);
      }
      if (article.cityId !== city?.id) problems.push(`ARTICLE_CITY:${planned.slug}`);
      if (article.status !== "PUBLISHED") problems.push(`ARTICLE_STATUS:${planned.slug}:${article.status}`);
      if (article.geoScope !== "CITY") problems.push(`ARTICLE_GEOSCOPE:${planned.slug}:${article.geoScope}`);
      if (article.noindex) problems.push(`ARTICLE_NOINDEX:${planned.slug}`);
      if (article.title !== planned.title) problems.push(`ARTICLE_TITLE:${planned.slug}`);
      if (article.seoTitle !== planned.seoTitle) problems.push(`ARTICLE_SEO_TITLE:${planned.slug}`);
      if (article.seoDescription !== planned.seoDescription) {
        problems.push(`ARTICLE_SEO_DESCRIPTION:${planned.slug}`);
      }
      if (stableJson(article.contentJson) !== stableJson(planned.contentJson)) {
        problems.push(`ARTICLE_CONTENT:${planned.slug}`);
      }
      if (article.publishedAt?.getTime() !== planned.sourceCreatedAt.getTime()) {
        problems.push(`ARTICLE_PUBLISHED_AT:${planned.slug}`);
      }
      if (
        article.category?.nameRu !== LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_NAME ||
        article.category?.slug !== LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_SLUG ||
        article.category?.publicationType !== "ARTICLE" ||
        !article.category?.isActive ||
        article.category?.archivedAt
      ) {
        problems.push(`ARTICLE_CATEGORY:${planned.slug}`);
      }
    }
  }

  return {
    phase: "PRE",
    mode: APPLY ? "APPLY" : "PLAN",
    result: problems.length === 0 ? (existingMode ? "VERIFIED" : "READY") : "STOP",
    migrationAction: existingMode ? "VERIFY_EXISTING_OR_REINDEX" : "CREATE_13",
    databaseTarget,
    expectedCount: EXPECTED_COUNT,
    expectedStops: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXPECTED_STOPS,
    city,
    cityCandidates,
    categoryAction: targetCategory
      ? targetCategory.isActive && !targetCategory.archivedAt
        ? "REUSE"
        : "REACTIVATE"
      : "CREATE",
    targetCategory,
    routes: routes.map((route) => ({
      id: route.id,
      slug: route.slug,
      title: route.title,
      status: route.status,
      visibility: route.visibility,
      createdAt: route.createdAt,
      stops: route.stops.length,
      photos: route.stops.filter((stop) => Boolean(stop.photoUrl?.trim())).length,
    })),
    plannedArticles: plannedArticles.map(({ contentJson: _contentJson, ...planned }) => ({
      ...planned,
      sourceCreatedAt: planned.sourceCreatedAt.toISOString(),
    })),
    currentArticles: articles.map(({ contentJson: _contentJson, ...article }) => article),
    articleLineages,
    excluded: {
      route: excludedRoute
        ? {
            id: excludedRoute.id,
            slug: excludedRoute.slug,
            status: excludedRoute.status,
            visibility: excludedRoute.visibility,
            stops: excludedRoute.stops.length,
          }
        : null,
      lineage: excludedLineage ?? null,
      articles: excludedArticles,
      articleLineages: excludedArticleLineages,
    },
    media: mediaAssets.map((asset) => ({
      id: asset.id,
      status: asset.status,
      publicUrl: asset.publicUrl,
      storageKey: asset.storageKey,
      deletedAt: asset.deletedAt,
    })),
    problems,
    warnings,
    _internal: { plannedArticles },
  };
}

type Inspection = Awaited<ReturnType<typeof inspectState>>;

async function strictReindexArticles(rows: Array<{ id: string; slug: string | null }>) {
  if (rows.length !== EXPECTED_COUNT) {
    throw new Error(`Strict reindex count mismatch: ${rows.length}/${EXPECTED_COUNT}`);
  }
  const indexer = new SearchIndexerService(prismaBase);
  for (const row of rows) await indexer.upsertArticleStrict(row.id);
  return rows.length;
}

async function applyMigration(plan: Inspection) {
  if (plan.result !== "READY" && plan.result !== "VERIFIED") {
    throw new Error(`Refusing APPLY: preflight result is ${plan.result}`);
  }
  if (!CONFIRM) throw new Error("Refusing APPLY: add --confirm-migration");
  assertApplyDatabaseTarget(plan.databaseTarget);
  if (!plan.city) throw new Error("Refusing APPLY: target city is missing");

  if (plan.result === "VERIFIED") {
    const indexedCount = await strictReindexArticles(
      plan.currentArticles.map((article) => ({ id: article.id, slug: article.slug })),
    );
    return { action: "REINDEX_EXISTING", createdCount: 0, indexedCount };
  }

  const result = await prismaBase.$transaction(async (tx) => {
    let category = plan.targetCategory;
    if (!category) {
      category = await tx.eventCategory.create({
        data: {
          nameRu: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_NAME,
          nameEn: "Routes",
          slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_SLUG,
          publicationType: "ARTICLE",
          isActive: true,
          isFeatured: false,
          sortOrder: 0,
          supportsProgram: false,
          selectableInProgram: false,
        },
        select: {
          id: true,
          nameRu: true,
          slug: true,
          publicationType: true,
          isActive: true,
          archivedAt: true,
        },
      });
    } else if (!category.isActive || category.archivedAt) {
      category = await tx.eventCategory.update({
        where: { id: category.id },
        data: { isActive: true, archivedAt: null },
        select: {
          id: true,
          nameRu: true,
          slug: true,
          publicationType: true,
          isActive: true,
          archivedAt: true,
        },
      });
    }

    const created: Array<{ articleId: string; slug: string; sourceRecordKey: string }> = [];
    for (const planned of plan._internal.plannedArticles) {
      const article = await tx.article.create({
        data: {
          slug: planned.slug,
          title: planned.title,
          contentJson: planned.contentJson as Prisma.InputJsonValue,
          authorUserId: null,
          authorLabel: null,
          cityId: plan.city.id,
          regionId: null,
          geoScope: "CITY",
          status: "PUBLISHED",
          noindex: false,
          categoryId: category.id,
          publishedAt: planned.sourceCreatedAt,
          createdAt: planned.sourceCreatedAt,
          seoTitle: planned.seoTitle,
          seoDescription: planned.seoDescription,
          seoH1: planned.seoH1,
          seoCanonicalUrl: null,
          seoOgTitle: planned.seoOgTitle,
          seoOgDescription: planned.seoOgDescription,
          seoOgImage: planned.seoOgImage,
          seoRobots: planned.seoRobots,
          seoCanonicalSource: "FALLBACK",
        },
        select: { id: true, slug: true },
      });

      await tx.migrationLineage.create({
        data: {
          sourceId: planned.sourceId,
          recordId: planned.recordId,
          runId: planned.runId,
          sourceEntityType: planned.sourceEntityType,
          sourceStableKey: planned.sourceStableKey,
          sourceRecordKey: planned.sourceRecordKey,
          targetType: "ARTICLE",
          targetId: article.id,
          targetRole: "primary",
          targetNaturalKey: planned.slug,
          lastSourceHash: planned.sourceHash,
          isActive: true,
          lastImportedAt: new Date(),
        },
      });
      created.push({
        articleId: article.id,
        slug: article.slug ?? planned.slug,
        sourceRecordKey: planned.sourceRecordKey,
      });
    }
    if (created.length !== EXPECTED_COUNT) {
      throw new Error(`Article create count mismatch: ${created.length}/${EXPECTED_COUNT}`);
    }
    return { category, created };
  });

  const indexedCount = await strictReindexArticles(
    result.created.map((row) => ({ id: row.articleId, slug: row.slug })),
  );

  return {
    action: "CREATE_AND_INDEX",
    category: result.category,
    createdCount: result.created.length,
    created: result.created,
    indexedCount,
  };
}

function printable(plan: Inspection) {
  const { _internal: _hidden, ...safe } = plan;
  return safe;
}

async function main() {
  const before = await inspectState();
  console.log(JSON.stringify(printable(before), null, 2));

  if (!APPLY) {
    if (before.result === "STOP") process.exitCode = 2;
    return;
  }

  const applied = await applyMigration(before);
  console.log(JSON.stringify({ phase: "APPLIED", applied }, null, 2));

  const after = await inspectState();
  console.log(JSON.stringify({ phase: "POST", ...printable(after) }, null, 2));
  if (after.result !== "VERIFIED") {
    throw new Error(`Post-migration verification failed: ${after.result}`);
  }
}

main()
  .catch((error) => {
    console.error("[legacy-routes-current-to-articles-migration]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
