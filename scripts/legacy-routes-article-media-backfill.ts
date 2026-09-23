import { Prisma, MediaEntityType } from "@prisma/client";
import NodeModule from "node:module";

import { prismaBase } from "../src/lib/prisma";
import {
  ArticleMediaReplaySyncer,
  PrismaArticleMediaAttachmentImportCoordinator,
} from "../src/lib/migration/commit/article/ArticleMediaReplaySyncer";
import { MigrationLineageWriter } from "../src/lib/migration/lineage/MigrationLineageWriter";
import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { WordPressRepository } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import { buildWordPressAttachmentSourceRecordKey } from "../src/lib/migration/place-media/attachmentSourceRecordKey";
import {
  DEV_DATABASE_NAME,
  LOCAL_GOLDEN_DATABASE_NAME,
  PROD_DATABASE_NAME,
  assertMigrationDatabaseTarget,
  parseMigrationDatabaseUrl,
} from "../src/lib/migration/runtime/migrationDatabaseTarget";
import {
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE,
} from "../src/lib/routes/legacyEditorialRouteArticleMigration";
import {
  LEGACY_ROUTE_ARTICLE_MEDIA_ATTACHMENT_COUNT,
  LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST,
} from "../src/lib/routes/legacyRouteArticleMediaManifest";
import {
  planLegacyRouteArticleMediaBackfill,
} from "../src/lib/routes/legacyRouteArticleMediaBackfill";
import {
  extractArticleMediaUsage,
  parseArticleContentJson,
} from "../src/lib/publications/articleMvp";
import { SearchIndexerService } from "../src/lib/search/SearchIndexerService";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-backfill");
const CONFIRM_PRODUCTION = process.argv.includes("--confirm-production");
const ALLOW_REMOTE_READONLY = process.argv.includes("--allow-remote-readonly");

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const EXPLICIT_MEDIA_OWNER_USER_ID = argValue("--media-owner-user-id");

type DatabaseTarget = {
  kind: "LOCAL_GOLDEN" | "DEV" | "PROD";
  currentDatabase: string;
};

type ResolvedMedia = {
  mediaId: string;
  publicUrl: string;
  uploadedById: string | null;
};

type RouteInspectionInternal = {
  sourceRecordKey: string;
  slug: string;
  sourceId: string;
  sourceHash: string | null;
  runId: string | null;
  recordId: string | null;
  article: {
    id: string;
    slug: string | null;
    title: string;
    status: string;
    updatedAt: Date;
    contentJson: unknown;
    coverImageId: string | null;
    seoImageId: string | null;
  };
  resolvedByAttachmentId: Map<number, ResolvedMedia>;
  missingAttachmentIds: number[];
};

let serverOnlyStubInstalled = false;
function installServerOnlyStub(): void {
  if (serverOnlyStubInstalled) return;
  serverOnlyStubInstalled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patchable = NodeModule as any;
  const originalLoad = patchable._load;
  patchable._load = function (request: string, ...rest: unknown[]) {
    if (request === "server-only") return {};
    return originalLoad.apply(this, [request, ...rest]);
  };
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

  if (currentDatabase === PROD_DATABASE_NAME) return { kind: "PROD", currentDatabase };
  if (currentDatabase === DEV_DATABASE_NAME) return { kind: "DEV", currentDatabase };
  if (currentDatabase === LOCAL_GOLDEN_DATABASE_NAME) return { kind: "LOCAL_GOLDEN", currentDatabase };
  throw new Error(`DATABASE_TARGET_REFUSED:${currentDatabase}`);
}

function assertApplyTarget(target: DatabaseTarget): void {
  if (!APPLY) return;
  if (!CONFIRM) throw new Error("Refusing APPLY: add --confirm-backfill");
  if (target.kind !== "PROD") return;
  assertMigrationDatabaseTarget({
    databaseUrl: process.env.DATABASE_URL,
    currentDatabase: target.currentDatabase,
    confirmProduction: CONFIRM_PRODUCTION,
    confirmWrites: true,
    requireProdUserAcknowledgement: false,
  });
}

const scopeBySourceKey = new Map(
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.map((item) => [item.sourceRecordKey, item] as const),
);

async function inspectState() {
  const databaseTarget = await inspectDatabaseTarget();
  const sourceKeys = LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.map((item) => item.sourceRecordKey);

  const [routeLineages, articleLineages] = await Promise.all([
    prismaBase.migrationLineage.findMany({
      where: {
        sourceRecordKey: { in: sourceKeys },
        targetType: "ROUTE",
        targetRole: "primary",
        isActive: true,
      },
      select: {
        sourceRecordKey: true,
        sourceId: true,
        targetId: true,
        lastSourceHash: true,
        runId: true,
        recordId: true,
      },
    }),
    prismaBase.migrationLineage.findMany({
      where: {
        sourceRecordKey: { in: sourceKeys },
        targetType: "ARTICLE",
        targetRole: "primary",
        isActive: true,
      },
      select: {
        sourceRecordKey: true,
        sourceId: true,
        targetId: true,
      },
    }),
  ]);

  const problems: string[] = [];
  if (routeLineages.length !== sourceKeys.length) {
    problems.push(`ROUTE_LINEAGE_COUNT:${routeLineages.length}/${sourceKeys.length}`);
  }
  if (articleLineages.length !== sourceKeys.length) {
    problems.push(`ARTICLE_LINEAGE_COUNT:${articleLineages.length}/${sourceKeys.length}`);
  }

  const articleIds = articleLineages
    .map((lineage) => lineage.targetId)
    .filter((id): id is string => Boolean(id));
  const articles = await prismaBase.article.findMany({
    where: { id: { in: articleIds } },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      contentJson: true,
      coverImageId: true,
      seoImageId: true,
    },
  });

  const routeByKey = new Map(routeLineages.map((row) => [row.sourceRecordKey, row] as const));
  const articleLineageByKey = new Map(articleLineages.map((row) => [row.sourceRecordKey, row] as const));
  const articleById = new Map(articles.map((row) => [row.id, row] as const));

  const lineageClauses = LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.flatMap((item) => {
    const routeLineage = routeByKey.get(item.sourceRecordKey);
    if (!routeLineage) return [];
    return [{
      sourceId: routeLineage.sourceId,
      sourceRecordKey: {
        in: item.stops.flatMap((stop) =>
          stop.attachmentIds.map((id) => buildWordPressAttachmentSourceRecordKey(id)),
        ),
      },
    }];
  });

  const attachmentLineages = lineageClauses.length
    ? await prismaBase.migrationLineage.findMany({
        where: {
          targetType: "MEDIA_ASSET",
          isActive: true,
          OR: lineageClauses,
        },
        select: {
          sourceId: true,
          sourceRecordKey: true,
          targetId: true,
          targetRole: true,
        },
      })
    : [];

  const mediaTargetIds = [
    ...new Set(
      attachmentLineages
        .map((lineage) => lineage.targetId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const mediaAssets = mediaTargetIds.length
    ? await prismaBase.mediaAsset.findMany({
        where: { id: { in: mediaTargetIds } },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          publicUrl: true,
          uploadedById: true,
        },
      })
    : [];
  const mediaById = new Map(mediaAssets.map((asset) => [asset.id, asset] as const));

  const internalRoutes: RouteInspectionInternal[] = [];
  const printableRoutes: Array<Record<string, unknown>> = [];
  const ownerIds = new Set<string>();
  let resolvedAttachmentCount = 0;
  let missingAttachmentCount = 0;

  for (const manifestItem of LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST) {
    const routeLineage = routeByKey.get(manifestItem.sourceRecordKey);
    const articleLineage = articleLineageByKey.get(manifestItem.sourceRecordKey);
    const scopeItem = scopeBySourceKey.get(manifestItem.sourceRecordKey);

    if (!routeLineage) {
      problems.push(`ROUTE_LINEAGE_MISSING:${manifestItem.sourceRecordKey}`);
      continue;
    }
    if (!articleLineage?.targetId) {
      problems.push(`ARTICLE_LINEAGE_MISSING:${manifestItem.sourceRecordKey}`);
      continue;
    }
    const article = articleById.get(articleLineage.targetId);
    if (!article) {
      problems.push(`ARTICLE_TARGET_MISSING:${manifestItem.sourceRecordKey}`);
      continue;
    }
    if (article.slug !== manifestItem.slug) {
      problems.push(
        `ARTICLE_SLUG_MISMATCH:${manifestItem.sourceRecordKey}:${article.slug ?? "<null>"}:${manifestItem.slug}`,
      );
    }
    if (article.status !== "PUBLISHED") {
      problems.push(`ARTICLE_STATUS:${manifestItem.sourceRecordKey}:${article.status}`);
    }
    if (!scopeItem) {
      problems.push(`SCOPE_ITEM_MISSING:${manifestItem.sourceRecordKey}`);
      continue;
    }

    const resolvedByAttachmentId = new Map<number, ResolvedMedia>();
    const missingAttachmentIds: number[] = [];
    let routeResolved = 0;
    let routeMissing = 0;
    const perStop: Array<{ order: number; source: number; resolved: number; missing: number }> = [];

    for (let order = 1; order <= scopeItem.expectedStops; order += 1) {
      const stop = manifestItem.stops.find((row) => row.order === order);
      const ids = stop?.attachmentIds ?? [];
      let stopResolved = 0;
      let stopMissing = 0;

      for (const attachmentId of ids) {
        const sourceRecordKey = buildWordPressAttachmentSourceRecordKey(attachmentId);
        const rows = attachmentLineages.filter(
          (lineage) =>
            lineage.sourceId === routeLineage.sourceId &&
            lineage.sourceRecordKey === sourceRecordKey,
        );
        if (rows.length === 0) {
          missingAttachmentIds.push(attachmentId);
          stopMissing += 1;
          continue;
        }

        const targetIds = [
          ...new Set(rows.map((row) => row.targetId).filter((id): id is string => Boolean(id))),
        ];
        if (targetIds.length !== 1) {
          problems.push(
            `ATTACHMENT_LINEAGE_AMBIGUOUS:${manifestItem.sourceRecordKey}:${attachmentId}:${targetIds.length}`,
          );
          continue;
        }

        const asset = mediaById.get(targetIds[0]);
        if (!asset || asset.deletedAt || asset.status !== "ACTIVE" || !asset.publicUrl?.trim()) {
          problems.push(
            `ATTACHMENT_LINEAGE_DANGLING:${manifestItem.sourceRecordKey}:${attachmentId}:${targetIds[0]}`,
          );
          continue;
        }

        resolvedByAttachmentId.set(attachmentId, {
          mediaId: asset.id,
          publicUrl: asset.publicUrl.trim(),
          uploadedById: asset.uploadedById,
        });
        if (asset.uploadedById) ownerIds.add(asset.uploadedById);
        stopResolved += 1;
      }

      routeResolved += stopResolved;
      routeMissing += stopMissing;
      if (ids.length > 0) {
        perStop.push({ order, source: ids.length, resolved: stopResolved, missing: stopMissing });
      }
    }

    resolvedAttachmentCount += routeResolved;
    missingAttachmentCount += routeMissing;

    internalRoutes.push({
      sourceRecordKey: manifestItem.sourceRecordKey,
      slug: manifestItem.slug,
      sourceId: routeLineage.sourceId,
      sourceHash: routeLineage.lastSourceHash,
      runId: routeLineage.runId,
      recordId: routeLineage.recordId,
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        status: article.status,
        updatedAt: article.updatedAt,
        contentJson: article.contentJson,
        coverImageId: article.coverImageId,
        seoImageId: article.seoImageId,
      },
      resolvedByAttachmentId,
      missingAttachmentIds: [...new Set(missingAttachmentIds)],
    });

    const current = parseArticleContentJson(article.contentJson);
    const currentLegacyMediaCount = current.blocks.reduce((count, block) => {
      if (!block.id.startsWith(`legacy-route-${manifestItem.sourceRecordKey.split(":").at(-1)}-stop-`)) {
        return count;
      }
      if (block.type === "image") return count + 1;
      if (block.type === "gallery") return count + block.mediaIds.length;
      return count;
    }, 0);

    printableRoutes.push({
      sourceRecordKey: manifestItem.sourceRecordKey,
      slug: manifestItem.slug,
      articleId: article.id,
      currentLegacyMediaCount,
      sourceAttachmentCount: routeResolved + routeMissing,
      resolvedAttachmentCount: routeResolved,
      missingAttachmentCount: routeMissing,
      perStop,
    });
  }

  const inferredOwnerUserId =
    ownerIds.size === 1 ? [...ownerIds][0] : null;

  if (
    missingAttachmentCount > 0 &&
    !EXPLICIT_MEDIA_OWNER_USER_ID &&
    ownerIds.size !== 1
  ) {
    problems.push(`MEDIA_OWNER_NOT_UNIQUE:${ownerIds.size}`);
  }

  return {
    result: problems.length === 0 ? "READY" : "STOP",
    mode: APPLY ? "APPLY" : "PLAN",
    databaseTarget,
    expectedArticles: LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.length,
    expectedSourceAttachments: LEGACY_ROUTE_ARTICLE_MEDIA_ATTACHMENT_COUNT,
    resolvedAttachmentCount,
    missingAttachmentCount,
    inferredMediaOwnerUserId: inferredOwnerUserId,
    explicitMediaOwnerUserId: EXPLICIT_MEDIA_OWNER_USER_ID ?? null,
    routes: printableRoutes,
    problems,
    _internal: {
      routes: internalRoutes,
      inferredOwnerUserId,
    },
  };
}

function printable(plan: Awaited<ReturnType<typeof inspectState>>) {
  const { _internal: _hidden, ...safe } = plan;
  return safe;
}

async function resolveMissingAttachments(
  plan: Awaited<ReturnType<typeof inspectState>>,
): Promise<{
  resolvedByRoute: Map<string, Map<number, ResolvedMedia>>;
  unavailableByRoute: Map<string, number[]>;
  importedCount: number;
  reusedCount: number;
}> {
  const resolvedByRoute = new Map<string, Map<number, ResolvedMedia>>();
  const unavailableByRoute = new Map<string, number[]>();
  let importedCount = 0;
  let reusedCount = 0;

  for (const route of plan._internal.routes) {
    resolvedByRoute.set(route.sourceRecordKey, new Map(route.resolvedByAttachmentId));
  }

  if (plan.missingAttachmentCount === 0) {
    return { resolvedByRoute, unavailableByRoute, importedCount, reusedCount };
  }

  const ownerUserId =
    EXPLICIT_MEDIA_OWNER_USER_ID ?? plan._internal.inferredOwnerUserId;
  if (!ownerUserId) throw new Error("Media owner is required for missing attachment imports");

  const owner = await prismaBase.user.findUnique({
    where: { id: ownerUserId },
    select: { id: true },
  });
  if (!owner) throw new Error(`MEDIA_OWNER_USER_NOT_FOUND:${ownerUserId}`);

  const wpConfig = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(wpConfig, ALLOW_REMOTE_READONLY);
  const executor = createWordPressSshMysqlExecutor(wpConfig);
  const wordpressRepository = new WordPressRepository(executor);

  installServerOnlyStub();
  const { createMamagoMediaImporter } = await import("../src/lib/migration/media");
  const lineageWriter = new MigrationLineageWriter(prismaBase);
  const syncer = new ArticleMediaReplaySyncer({
    prisma: prismaBase,
    attachmentResolver: wordpressRepository,
    mediaImporterFactory: (uploadedByUserId: string) =>
      createMamagoMediaImporter({ uploadedByUserId }),
    lineageWriter,
    attachmentImportCoordinator: new PrismaArticleMediaAttachmentImportCoordinator(prismaBase),
  });

  for (const route of plan._internal.routes) {
    if (route.missingAttachmentIds.length === 0) continue;
    if (!route.sourceHash?.trim()) {
      throw new Error(`SOURCE_HASH_MISSING:${route.sourceRecordKey}`);
    }

    const preflight = await syncer.checkAttachmentLineageStates({
      ids: route.missingAttachmentIds,
      sourceId: route.sourceId,
    });
    const dangling = [...preflight.entries()].filter(
      ([, state]) => state.state === "DANGLING_ACTIVE_LINEAGE",
    );
    if (dangling.length > 0) {
      throw new Error(
        `DANGLING_ATTACHMENT_LINEAGE:${route.sourceRecordKey}:${dangling.map(([id]) => id).join(",")}`,
      );
    }

    const outcomes = await syncer.resolveAndImportAttachments({
      ids: route.missingAttachmentIds,
      ownerUserId,
      sourceId: route.sourceId,
      sourceHash: route.sourceHash,
      runId: route.runId,
      recordId: route.recordId,
    });

    const routeResolved = resolvedByRoute.get(route.sourceRecordKey)!;
    const unavailable: number[] = [];

    for (const attachmentId of route.missingAttachmentIds) {
      const outcome = outcomes.get(attachmentId);
      if (!outcome) {
        throw new Error(`ATTACHMENT_OUTCOME_MISSING:${route.sourceRecordKey}:${attachmentId}`);
      }
      if (outcome.ok) {
        routeResolved.set(attachmentId, {
          mediaId: outcome.mediaId,
          publicUrl: outcome.publicUrl,
          uploadedById: ownerUserId,
        });
        if (outcome.reused) reusedCount += 1;
        else importedCount += 1;
        continue;
      }

      if (
        outcome.code === "ARTICLE_MEDIA_ATTACHMENT_MISSING" ||
        outcome.code === "ARTICLE_MEDIA_URL_INVALID" ||
        outcome.code === "ARTICLE_MEDIA_UNSUPPORTED_MIME"
      ) {
        unavailable.push(attachmentId);
        continue;
      }

      throw new Error(
        `ATTACHMENT_IMPORT_FAILED:${route.sourceRecordKey}:${attachmentId}:${outcome.code}:${outcome.message}`,
      );
    }

    if (unavailable.length > 0) unavailableByRoute.set(route.sourceRecordKey, unavailable);
  }

  return { resolvedByRoute, unavailableByRoute, importedCount, reusedCount };
}

async function applyArticleContent(
  plan: Awaited<ReturnType<typeof inspectState>>,
  media: Awaited<ReturnType<typeof resolveMissingAttachments>>,
) {
  const articlePlans: Array<{
    article: RouteInspectionInternal["article"];
    sourceRecordKey: string;
    content: ReturnType<typeof parseArticleContentJson>;
    desiredMediaCount: number;
    changed: boolean;
  }> = [];

  for (const route of plan._internal.routes) {
    const scopeItem = scopeBySourceKey.get(route.sourceRecordKey);
    const manifestItem = LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.find(
      (item) => item.sourceRecordKey === route.sourceRecordKey,
    );
    if (!scopeItem || !manifestItem) {
      throw new Error(`MANIFEST_SCOPE_MISSING:${route.sourceRecordKey}`);
    }

    const resolved = media.resolvedByRoute.get(route.sourceRecordKey)!;
    const stopInputs = Array.from({ length: scopeItem.expectedStops }, (_, index) => {
      const order = index + 1;
      const sourceStop = manifestItem.stops.find((stop) => stop.order === order);
      const mediaIds = (sourceStop?.attachmentIds ?? [])
        .map((attachmentId) => resolved.get(attachmentId)?.mediaId)
        .filter((mediaId): mediaId is string => Boolean(mediaId));
      return { order, mediaIds };
    });

    const contentPlan = planLegacyRouteArticleMediaBackfill({
      sourceRecordKey: route.sourceRecordKey,
      currentContent: route.article.contentJson,
      stops: stopInputs,
    });
    if (!contentPlan.ok) {
      throw new Error(
        `ARTICLE_CONTENT_REFUSED:${route.sourceRecordKey}:${contentPlan.errors.join("|")}`,
      );
    }

    articlePlans.push({
      article: route.article,
      sourceRecordKey: route.sourceRecordKey,
      content: contentPlan.content,
      desiredMediaCount: contentPlan.desiredMediaCount,
      changed: contentPlan.changed,
    });
  }

  const changed = articlePlans.filter((row) => row.changed);

  await prismaBase.$transaction(async (tx) => {
    for (const row of changed) {
      const update = await tx.article.updateMany({
        where: {
          id: row.article.id,
          updatedAt: row.article.updatedAt,
        },
        data: {
          contentJson: row.content as Prisma.InputJsonValue,
        },
      });
      if (update.count !== 1) {
        throw new Error(`ARTICLE_CAS_FAILED:${row.sourceRecordKey}`);
      }

      const usages = extractArticleMediaUsage({
        coverImageId: row.article.coverImageId,
        seoImageId: row.article.seoImageId,
        blocks: row.content.blocks,
      });
      const usageRows: Array<{
        mediaId: string;
        entityType: MediaEntityType;
        entityId: string;
        field: string;
      }> = [];
      const seen = new Set<string>();
      for (const usage of usages) {
        for (const field of usage.usage) {
          const key = `${usage.mediaId}:${field}`;
          if (seen.has(key)) continue;
          seen.add(key);
          usageRows.push({
            mediaId: usage.mediaId,
            entityType: MediaEntityType.ARTICLE,
            entityId: row.article.id,
            field,
          });
        }
      }

      await tx.mediaUsage.deleteMany({
        where: {
          entityType: MediaEntityType.ARTICLE,
          entityId: row.article.id,
        },
      });
      if (usageRows.length > 0) {
        await tx.mediaUsage.createMany({ data: usageRows });
      }
    }
  });

  const indexer = new SearchIndexerService(prismaBase);
  for (const row of changed) {
    await indexer.upsertArticleStrict(row.article.id);
  }

  return {
    changedArticleCount: changed.length,
    unchangedArticleCount: articlePlans.length - changed.length,
    desiredMediaCount: articlePlans.reduce((sum, row) => sum + row.desiredMediaCount, 0),
    changedArticles: changed.map((row) => ({
      sourceRecordKey: row.sourceRecordKey,
      articleId: row.article.id,
      slug: row.article.slug,
      desiredMediaCount: row.desiredMediaCount,
    })),
  };
}

async function main() {
  const before = await inspectState();
  console.log(JSON.stringify({ phase: "PRE", ...printable(before) }, null, 2));

  if (!APPLY) {
    if (before.result !== "READY") process.exitCode = 2;
    return;
  }

  if (before.result !== "READY") {
    throw new Error("Refusing APPLY: preflight result is STOP");
  }
  assertApplyTarget(before.databaseTarget);

  const media = await resolveMissingAttachments(before);
  const applied = await applyArticleContent(before, media);

  console.log(
    JSON.stringify(
      {
        phase: "APPLIED",
        media: {
          importedCount: media.importedCount,
          reusedCount: media.reusedCount,
          permanentlyUnavailableAttachmentIds: Object.fromEntries(media.unavailableByRoute),
        },
        articles: applied,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[legacy-routes-article-media-backfill]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
