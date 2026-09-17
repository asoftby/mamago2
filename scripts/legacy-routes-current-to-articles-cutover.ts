import { existsSync } from "fs";
import { prismaBase } from "../src/lib/prisma";
import { SearchIndexerService } from "../src/lib/search/SearchIndexerService";
import {
  LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_SLUG,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG,
  LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG,
  LEGACY_EDITORIAL_ROUTE_SLUGS,
} from "../src/lib/routes/legacyEditorialRouteCutover";
import {
  assertMigrationDatabaseTarget,
  DEV_DATABASE_NAME,
  LOCAL_GOLDEN_DATABASE_NAME,
  parseMigrationDatabaseUrl,
  PROD_DATABASE_NAME,
} from "../src/lib/migration/runtime/migrationDatabaseTarget";
import { DEFAULT_COUNTRY_ISO } from "../src/server/geo/geoConstants";
import { resolveStoredMediaPath } from "../src/server/media/media-storage";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-cutover");
const CONFIRM_PRODUCTION = process.argv.includes("--confirm-production");
const EXPECTED_COUNT = LEGACY_EDITORIAL_ROUTE_SLUGS.length;

type DatabaseTarget = {
  kind: "LOCAL_GOLDEN" | "DEV" | "PROD";
  urlDatabase: string;
  currentDatabase: string;
};

function collectMediaIds(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectMediaIds(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "mediaId" && typeof child === "string" && child.trim()) {
      output.add(child.trim());
    } else {
      collectMediaIds(child, output);
    }
  }
  return output;
}

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

function sourceRouteStateAllowed(status: string, visibility: string): boolean {
  return (
    (status === "DRAFT" && visibility === "PRIVATE") ||
    (status === "PUBLISHED" && visibility === "PUBLIC") ||
    status === "ARCHIVED"
  );
}

async function inspectState() {
  const databaseTarget = await inspectDatabaseTarget();

  const cityCandidates = await prismaBase.city.findMany({
    where: {
      slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG,
      country: { isoCode: DEFAULT_COUNTRY_ISO },
      isLegacyNonCity: false,
      isActive: true,
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
    where: { slug: { in: [...LEGACY_EDITORIAL_ROUTE_SLUGS] } },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      visibility: true,
      authorId: true,
      cityId: true,
      _count: { select: { stops: true } },
    },
    orderBy: { slug: "asc" },
  });

  const excludedRoute = await prismaBase.route.findUnique({
    where: { slug: LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG },
    select: { id: true, slug: true, status: true, visibility: true, cityId: true },
  });

  const articles = city
    ? await prismaBase.article.findMany({
        where: {
          cityId: city.id,
          slug: { in: [...LEGACY_EDITORIAL_ROUTE_SLUGS] },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          geoScope: true,
          cityId: true,
          categoryId: true,
          noindex: true,
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
      })
    : [];

  const sameSlugArticles = await prismaBase.article.findMany({
    where: { slug: { in: [...LEGACY_EDITORIAL_ROUTE_SLUGS] } },
    select: { id: true, slug: true, cityId: true, geoScope: true, status: true },
  });

  const excludedArticles = await prismaBase.article.findMany({
    where: { slug: LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG },
    select: { id: true, slug: true, cityId: true, status: true },
  });

  const targetCategoryCandidates = await prismaBase.eventCategory.findMany({
    where: {
      OR: [
        { nameRu: LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME },
        { slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_SLUG },
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

  const exactNamedArticleCategories = targetCategoryCandidates.filter(
    (category) =>
      category.nameRu === LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME &&
      category.slug === LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_SLUG &&
      category.publicationType === "ARTICLE",
  );
  const slugConflicts = targetCategoryCandidates.filter(
    (category) =>
      category.slug === LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_SLUG &&
      !(
        category.nameRu === LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME &&
        category.publicationType === "ARTICLE"
      ),
  );

  const mediaIds = Array.from(
    articles.reduce((ids, article) => collectMediaIds(article.contentJson, ids), new Set<string>()),
  );
  const mediaAssets = mediaIds.length
    ? await prismaBase.mediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: {
          id: true,
          status: true,
          filename: true,
          storageKey: true,
          publicUrl: true,
          deletedAt: true,
        },
        orderBy: { id: "asc" },
      })
    : [];

  const media = mediaAssets.map((asset) => {
    const canonicalPath =
      resolveStoredMediaPath(asset.publicUrl) ?? resolveStoredMediaPath(asset.storageKey);
    return {
      ...asset,
      canonicalPath,
      fileExists: Boolean(canonicalPath && existsSync(canonicalPath)),
    };
  });

  const problems: string[] = [];
  const warnings: string[] = [];

  if (cityCandidates.length === 0) {
    problems.push(`TARGET_CITY_MISSING:${DEFAULT_COUNTRY_ISO}/${LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG}`);
  } else if (cityCandidates.length > 1) {
    problems.push(`TARGET_CITY_AMBIGUOUS:${cityCandidates.length}`);
  }
  if (routes.length !== EXPECTED_COUNT) problems.push(`ROUTE_COUNT:${routes.length}/${EXPECTED_COUNT}`);
  if (articles.length !== EXPECTED_COUNT) problems.push(`ARTICLE_COUNT:${articles.length}/${EXPECTED_COUNT}`);
  if (sameSlugArticles.length !== EXPECTED_COUNT) {
    problems.push(`ARTICLE_SLUG_SCOPE_COUNT:${sameSlugArticles.length}/${EXPECTED_COUNT}`);
  }
  if (excludedArticles.length > 0) {
    problems.push(`EXCLUDED_ROUTE_ARTICLE_PRESENT:${excludedArticles.length}`);
  }

  for (const slug of LEGACY_EDITORIAL_ROUTE_SLUGS) {
    const route = routes.find((row) => row.slug === slug);
    if (!route) {
      problems.push(`ROUTE_MISSING:${slug}`);
      continue;
    }
    if (route.authorId !== null) problems.push(`ROUTE_NOT_EDITORIAL:${slug}`);
    if (!sourceRouteStateAllowed(route.status, route.visibility)) {
      problems.push(`ROUTE_STATE:${slug}:${route.status}/${route.visibility}`);
    }

    const article = articles.find((row) => row.slug === slug);
    if (!article) {
      problems.push(`ARTICLE_MISSING:${slug}`);
      continue;
    }
    if (article.status !== "PUBLISHED") problems.push(`ARTICLE_STATUS:${slug}:${article.status}`);
    if (article.geoScope !== "CITY") problems.push(`ARTICLE_GEOSCOPE:${slug}:${article.geoScope}`);
    if (article.noindex) problems.push(`ARTICLE_NOINDEX:${slug}`);
  }

  if (exactNamedArticleCategories.length > 1) {
    problems.push(`TARGET_CATEGORY_DUPLICATE:${exactNamedArticleCategories.length}`);
  }
  if (slugConflicts.length > 0) {
    problems.push(`TARGET_CATEGORY_SLUG_CONFLICT:${slugConflicts.map((row) => row.id).join(",")}`);
  }

  if (!excludedRoute) {
    problems.push(`EXCLUDED_ROUTE_NOT_FOUND:${LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG}`);
  } else if (excludedRoute.status === "ARCHIVED") {
    problems.push(`EXCLUDED_ROUTE_WAS_ARCHIVED:${LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG}`);
  }

  if (mediaAssets.length !== mediaIds.length) {
    problems.push(`ARTICLE_MEDIA_ASSETS:${mediaAssets.length}/${mediaIds.length}`);
  }
  const invalidMedia = media.filter(
    (asset) => asset.status !== "ACTIVE" || Boolean(asset.deletedAt) || !asset.fileExists,
  );
  if (invalidMedia.length > 0) {
    problems.push(`ARTICLE_MEDIA_INVALID:${invalidMedia.length}/${media.length}`);
  }

  const targetCategory = exactNamedArticleCategories[0] ?? null;

  return {
    result: problems.length === 0 ? "READY" : "STOP",
    mode: APPLY ? "APPLY" : "PLAN",
    databaseTarget,
    expectedCount: EXPECTED_COUNT,
    city,
    cityCandidates,
    routes,
    excludedRoute,
    excludedArticles,
    articles: articles.map(({ contentJson: _contentJson, ...article }) => article),
    sameSlugArticles,
    targetCategory,
    targetCategoryCandidates,
    categoryAction: targetCategory
      ? targetCategory.isActive && !targetCategory.archivedAt
        ? "REUSE"
        : "REACTIVATE"
      : "CREATE",
    media,
    problems,
    warnings,
  };
}

async function applyCutover(plan: Awaited<ReturnType<typeof inspectState>>) {
  if (plan.result !== "READY") throw new Error("Refusing APPLY: preflight result is STOP");
  if (!CONFIRM) throw new Error("Refusing APPLY: add --confirm-cutover");
  assertApplyDatabaseTarget(plan.databaseTarget);
  if (!plan.city) throw new Error("Refusing APPLY: target city is missing");

  const articleIds = plan.articles.map((article) => article.id);
  const routeIds = plan.routes.map((route) => route.id);

  const transactionResult = await prismaBase.$transaction(async (tx) => {
    let category = plan.targetCategory;
    if (!category) {
      category = await tx.eventCategory.create({
        data: {
          nameRu: LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME,
          nameEn: "Routes",
          slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_SLUG,
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

    const updatedArticles = await tx.article.updateMany({
      where: {
        id: { in: articleIds },
        cityId: plan.city.id,
        status: "PUBLISHED",
        geoScope: "CITY",
      },
      data: { categoryId: category.id },
    });
    if (updatedArticles.count !== EXPECTED_COUNT) {
      throw new Error(`Article CAS failed: ${updatedArticles.count}/${EXPECTED_COUNT}`);
    }

    const updatedRoutes = await tx.route.updateMany({
      where: {
        id: { in: routeIds },
        authorId: null,
        status: { in: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
      },
      data: { status: "ARCHIVED" },
    });
    if (updatedRoutes.count !== EXPECTED_COUNT) {
      throw new Error(`Route CAS failed: ${updatedRoutes.count}/${EXPECTED_COUNT}`);
    }

    return {
      category,
      updatedArticles: updatedArticles.count,
      archivedRoutes: updatedRoutes.count,
    };
  });

  const removedRouteSearchDocs = await prismaBase.searchDocument.deleteMany({
    where: { entityType: "route", entityId: { in: routeIds } },
  });

  const indexer = new SearchIndexerService(prismaBase);
  for (const articleId of articleIds) await indexer.upsertArticleStrict(articleId);

  return {
    ...transactionResult,
    removedRouteSearchDocs: removedRouteSearchDocs.count,
    indexedArticles: articleIds.length,
  };
}

async function main() {
  const before = await inspectState();
  console.log(JSON.stringify({ phase: "PRE", ...before }, null, 2));

  if (!APPLY) {
    if (before.result !== "READY") process.exitCode = 2;
    return;
  }

  const applied = await applyCutover(before);
  const after = await inspectState();
  console.log(JSON.stringify({ phase: "APPLIED", applied }, null, 2));
  console.log(JSON.stringify({ phase: "POST", ...after }, null, 2));

  if (after.result !== "READY") throw new Error("Post-cutover verification failed");
  if (after.routes.some((route) => route.status !== "ARCHIVED")) {
    throw new Error("Post-cutover verification failed: not all routes archived");
  }
  if (
    after.articles.some(
      (article) =>
        article.category?.nameRu !== LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME ||
        article.category?.publicationType !== "ARTICLE",
    )
  ) {
    throw new Error("Post-cutover verification failed: article category mismatch");
  }
}

main()
  .catch((error) => {
    console.error("[legacy-routes-current-to-articles-cutover]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
