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
import { DEFAULT_COUNTRY_ISO } from "../src/server/geo/geoConstants";
import { resolveStoredMediaPath } from "../src/server/media/media-storage";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-cutover");
const CONFIRM_PRODUCTION = process.argv.includes("--confirm-production");
const EXPECTED_COUNT = LEGACY_EDITORIAL_ROUTE_SLUGS.length;
const EXPECTED_NOVOGODNIY_MEDIA = 9;

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

function isProductionEnvironment(): boolean {
  const values = [process.env.APP_ENV, process.env.DEPLOY_ENV, process.env.NODE_ENV]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.includes("production") || values.includes("prod");
}

async function inspectState() {
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

  const novogodniy = articles.find((article) => article.slug === "novogodniy-marshrut") ?? null;
  const mediaIds = novogodniy ? [...collectMediaIds(novogodniy.contentJson)] : [];
  const mediaAssets = mediaIds.length
    ? await prismaBase.mediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: {
          id: true,
          status: true,
          filename: true,
          storageKey: true,
          publicUrl: true,
          sizeBytes: true,
          checksum: true,
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
    problems.push(
      `TARGET_CITY_MISSING:${DEFAULT_COUNTRY_ISO}/${LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG}`,
    );
  } else if (cityCandidates.length > 1) {
    problems.push(
      `TARGET_CITY_AMBIGUOUS:${DEFAULT_COUNTRY_ISO}/${LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG}:${cityCandidates
        .map((candidate) => `${candidate.id}/${candidate.country.isoCode}`)
        .join(",")}`,
    );
  }
  if (routes.length !== EXPECTED_COUNT) {
    problems.push(`ROUTE_COUNT:${routes.length}/${EXPECTED_COUNT}`);
  }
  if (articles.length !== EXPECTED_COUNT) {
    problems.push(`ARTICLE_COUNT:${articles.length}/${EXPECTED_COUNT}`);
  }

  for (const slug of LEGACY_EDITORIAL_ROUTE_SLUGS) {
    const route = routes.find((row) => row.slug === slug);
    if (!route) {
      problems.push(`ROUTE_MISSING:${slug}`);
      continue;
    }
    if (route.authorId !== null) problems.push(`ROUTE_NOT_EDITORIAL:${slug}`);
    const routeStateOk =
      (route.status === "PUBLISHED" && route.visibility === "PUBLIC") ||
      route.status === "ARCHIVED";
    if (!routeStateOk) {
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

  if (sameSlugArticles.length !== EXPECTED_COUNT) {
    problems.push(`ARTICLE_SLUG_SCOPE_COUNT:${sameSlugArticles.length}/${EXPECTED_COUNT}`);
  }

  if (exactNamedArticleCategories.length > 1) {
    problems.push(`TARGET_CATEGORY_DUPLICATE:${exactNamedArticleCategories.length}`);
  }
  if (slugConflicts.length > 0) {
    problems.push(`TARGET_CATEGORY_SLUG_CONFLICT:${slugConflicts.map((row) => row.id).join(",")}`);
  }

  if (!excludedRoute) {
    warnings.push(`EXCLUDED_ROUTE_NOT_FOUND:${LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG}`);
  } else if (excludedRoute.status === "ARCHIVED") {
    problems.push(`EXCLUDED_ROUTE_WAS_ARCHIVED:${LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG}`);
  }

  if (mediaIds.length !== EXPECTED_NOVOGODNIY_MEDIA) {
    problems.push(`NOVOGODNIY_MEDIA_BLOCKS:${mediaIds.length}/${EXPECTED_NOVOGODNIY_MEDIA}`);
  }
  if (mediaAssets.length !== mediaIds.length) {
    problems.push(`NOVOGODNIY_MEDIA_ASSETS:${mediaAssets.length}/${mediaIds.length}`);
  }
  const missingFiles = media.filter((asset) => !asset.fileExists);
  if (missingFiles.length > 0) {
    problems.push(`NOVOGODNIY_MEDIA_FILES_MISSING:${missingFiles.length}/${media.length}`);
  }

  const targetCategory = exactNamedArticleCategories[0] ?? null;

  return {
    result: problems.length === 0 ? "READY" : "STOP",
    mode: APPLY ? "APPLY" : "PLAN",
    expectedCount: EXPECTED_COUNT,
    city,
    cityCandidates,
    routes,
    excludedRoute,
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
  if (plan.result !== "READY") {
    throw new Error("Refusing APPLY: preflight result is STOP");
  }
  if (!CONFIRM) {
    throw new Error("Refusing APPLY: add --confirm-cutover");
  }
  if (isProductionEnvironment() && !CONFIRM_PRODUCTION) {
    throw new Error("Refusing production APPLY: add --confirm-production");
  }

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
        cityId: plan.city!.id,
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
        status: { in: ["PUBLISHED", "ARCHIVED"] },
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
  for (const articleId of articleIds) {
    await indexer.upsertArticleStrict(articleId);
  }

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

  if (after.result !== "READY") {
    throw new Error("Post-cutover verification failed");
  }
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
    console.error("[legacy-routes-to-articles-cutover]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
