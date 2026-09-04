import type { PrismaClient } from "@prisma/client";
import { ContentStatus, GeoScope } from "@prisma/client";
import { PHASE_2A_PRIORITY_RECOVERIES } from "./phase2aPriorityRecovery";

export const GRODNO_REGION_ARTICLE_RECOVERY = {
  articleId: "cmssu87vb00jews3fk0gbskm1",
  title: "Любимые места в Гродно и в окрестностях: на машине или автодоме",
  slug: "lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
  regionId: "region_grodnenskaya_oblast",
  regionSlug: "grodnenskaya-oblast",
  countryId: "country_belarus",
  expectedUpdatedAt: "2026-08-14T11:02:34.120Z",
  publishedAt: "2026-02-03T21:37:35.000Z",
  blocksCount: 182,
  noindex: false,
  seoRobots: null as string | null,
  finalCanonicalPath: "/blog/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
} as const;

type RecoveryBefore = {
  status: string;
  geoScope: string | null;
  cityId: string | null;
  regionId: string | null;
  updatedAt: string;
  publishedAt: string | null;
  noindex: boolean;
  seoRobots: string | null;
  slug: string | null;
  title: string;
  blocksCount: number | null;
};

export type GrodnoRegionRecoveryPlan = {
  action: "apply" | "already_applied" | "conflict" | "not_found";
  before: RecoveryBefore | null;
  reason?: string;
};

function blocksCount(contentJson: unknown): number | null {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return null;
  const blocks = (contentJson as { blocks?: unknown }).blocks;
  return Array.isArray(blocks) ? blocks.length : null;
}

function canonicalOwnerDecisionIsCommitted(): boolean {
  const expected = GRODNO_REGION_ARTICLE_RECOVERY;
  const entry = PHASE_2A_PRIORITY_RECOVERIES.find(
    (candidate) => candidate.legacySourcePath === `/${expected.slug}`,
  );
  return Boolean(
    entry &&
      entry.targetArticleId === expected.articleId &&
      entry.readiness === "READY_WITH_EXACT_MAPPING" &&
      entry.geoScope === null &&
      entry.resolvedGeoScope === "REGION" &&
      entry.regionSlug === expected.regionSlug &&
      entry.ownerReviewBatch === undefined &&
      entry.ownerDecision,
  );
}

function auditedDrift(before: RecoveryBefore, includeUpdatedAt: boolean): string[] {
  const expected = GRODNO_REGION_ARTICLE_RECOVERY;
  const drift: string[] = [];
  if (before.slug !== expected.slug) drift.push(`slug=${before.slug}`);
  if (before.title !== expected.title) drift.push(`title=${before.title}`);
  if (includeUpdatedAt && before.updatedAt !== expected.expectedUpdatedAt) {
    drift.push(`updatedAt=${before.updatedAt}`);
  }
  if (before.publishedAt !== expected.publishedAt) drift.push(`publishedAt=${before.publishedAt}`);
  if (before.noindex !== expected.noindex) drift.push(`noindex=${before.noindex}`);
  if (before.seoRobots !== expected.seoRobots) drift.push(`seoRobots=${before.seoRobots}`);
  if (before.blocksCount !== expected.blocksCount) drift.push(`blocksCount=${before.blocksCount}`);
  return drift;
}

export async function buildGrodnoRegionRecoveryPlan(
  prisma: PrismaClient,
): Promise<GrodnoRegionRecoveryPlan> {
  const expected = GRODNO_REGION_ARTICLE_RECOVERY;
  if (!canonicalOwnerDecisionIsCommitted()) {
    return {
      action: "conflict",
      before: null,
      reason: "canonical Phase 2A owner decision for Grodno REGION is missing or inconsistent",
    };
  }

  const region = await prisma.region.findUnique({
    where: { id: expected.regionId },
    select: { id: true, slug: true, countryId: true },
  });
  if (!region || region.slug !== expected.regionSlug || region.countryId !== expected.countryId) {
    return { action: "conflict", before: null, reason: "target Grodno region identity mismatch" };
  }

  const article = await prisma.article.findUnique({
    where: { id: expected.articleId },
    select: {
      status: true,
      geoScope: true,
      cityId: true,
      regionId: true,
      updatedAt: true,
      publishedAt: true,
      noindex: true,
      seoRobots: true,
      slug: true,
      title: true,
      contentJson: true,
    },
  });
  if (!article) return { action: "not_found", before: null, reason: "article missing" };

  const before: RecoveryBefore = {
    status: article.status,
    geoScope: article.geoScope,
    cityId: article.cityId,
    regionId: article.regionId,
    updatedAt: article.updatedAt.toISOString(),
    publishedAt: article.publishedAt?.toISOString() ?? null,
    noindex: article.noindex,
    seoRobots: article.seoRobots,
    slug: article.slug,
    title: article.title,
    blocksCount: blocksCount(article.contentJson),
  };

  const alreadyApplied =
    before.status === ContentStatus.PUBLISHED &&
    before.geoScope === GeoScope.REGION &&
    before.cityId === null &&
    before.regionId === expected.regionId;

  if (alreadyApplied) {
    const drift = auditedDrift(before, false);
    return drift.length === 0
      ? { action: "already_applied", before }
      : { action: "conflict", before, reason: `post-repair drift: ${drift.join("; ")}` };
  }

  const drift = auditedDrift(before, true);
  if (drift.length > 0) {
    return { action: "conflict", before, reason: `audited state drift: ${drift.join("; ")}` };
  }

  const preRepair =
    before.status === ContentStatus.PENDING &&
    before.geoScope === null &&
    before.cityId === null &&
    before.regionId === null;
  if (!preRepair) {
    return {
      action: "conflict",
      before,
      reason: `unexpected publication geography: ${before.status}/${before.geoScope}/${before.cityId}/${before.regionId}`,
    };
  }

  return { action: "apply", before };
}

export type StrictArticleIndexer = { upsertArticleStrict(articleId: string): Promise<void> };

export async function applyGrodnoRegionRecovery(
  prisma: PrismaClient,
  plan: GrodnoRegionRecoveryPlan,
  indexer: StrictArticleIndexer,
): Promise<void> {
  const expected = GRODNO_REGION_ARTICLE_RECOVERY;
  if (!canonicalOwnerDecisionIsCommitted()) {
    throw new Error("[grodno-region-recovery] refusing apply: canonical owner decision is missing or inconsistent");
  }
  if (plan.action === "conflict" || plan.action === "not_found") {
    throw new Error(`[grodno-region-recovery] refusing apply: ${plan.action}: ${plan.reason ?? "unknown"}`);
  }

  if (plan.action === "apply") {
    await prisma.$transaction(async (tx) => {
      const result = await tx.article.updateMany({
        where: {
          id: expected.articleId,
          slug: expected.slug,
          status: ContentStatus.PENDING,
          geoScope: null,
          cityId: null,
          regionId: null,
          updatedAt: new Date(expected.expectedUpdatedAt),
        },
        data: {
          status: ContentStatus.PUBLISHED,
          geoScope: GeoScope.REGION,
          cityId: null,
          regionId: expected.regionId,
        },
      });
      if (result.count !== 1) {
        throw new Error(`[grodno-region-recovery] atomic update guard failed: count=${result.count}`);
      }
    });
  }

  await indexer.upsertArticleStrict(expected.articleId);
  const doc = await prisma.searchDocument.findUnique({
    where: { entityType_entityId: { entityType: "article", entityId: expected.articleId } },
    select: { isPublished: true, urlPath: true, title: true },
  });
  if (!doc) throw new Error("[grodno-region-recovery] SearchDocument missing after reindex");
  if (!doc.isPublished || doc.urlPath !== expected.finalCanonicalPath || doc.title !== expected.title) {
    throw new Error(
      `[grodno-region-recovery] SearchDocument mismatch: ${JSON.stringify(doc)}`,
    );
  }
}
