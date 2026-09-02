import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import type { MigratedArticlePublicationGeoRecovery } from "./migratedArticlePublicationGeoRecovery";
import type { Phase2ARecoveryEntry } from "./phase2aPriorityRecovery";

export const PHASE_2A_PLAN_SCHEMA = "mamago.phase2a.article-recovery-plan.v1" as const;

export type Phase2APlanArtifactRow = {
  articleId: string;
  slug: string;
  rawTitle: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  noindex: boolean | null;
  seoRobots: string | null;
  blocksCount: number | null;
  contentSha256: string | null;
  current: {
    status: string | null;
    geoScope: string | null;
    cityId: string | null;
    regionId: string | null;
  };
  target: {
    status: "PUBLISHED";
    geoScope: "CITY" | "COUNTRY";
    cityId: string | null;
  };
  canonicalPath: string;
  legacyUrl: string;
  confidence: "HIGH" | "MEDIUM";
  action: "apply" | "already_applied" | "conflict" | "not_found";
  reason?: string;
};

export type Phase2APlanArtifact = {
  schema: typeof PHASE_2A_PLAN_SCHEMA;
  generatedAt: string;
  expectedAutomated: number;
  minskCityId: string;
  rows: Phase2APlanArtifactRow[];
  sha256: string;
};

type UnsignedArtifact = Omit<Phase2APlanArtifact, "sha256">;

export function checksumPhase2APlan(artifact: UnsignedArtifact): string {
  return createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
}

export function signPhase2APlan(artifact: UnsignedArtifact): Phase2APlanArtifact {
  return { ...artifact, sha256: checksumPhase2APlan(artifact) };
}

export function validatePhase2APlanArtifact(value: unknown): Phase2APlanArtifact {
  if (!value || typeof value !== "object") throw new Error("invalid PLAN artifact: expected object");
  const artifact = value as Phase2APlanArtifact;
  if (artifact.schema !== PHASE_2A_PLAN_SCHEMA) throw new Error("invalid PLAN artifact schema");
  if (!Array.isArray(artifact.rows) || artifact.rows.length !== artifact.expectedAutomated) {
    throw new Error("invalid PLAN artifact: incomplete expected row set");
  }
  if (!artifact.rows.every((row) => row.articleId && row.slug && row.target && row.canonicalPath &&
    (row.action === "not_found" ? row.contentSha256 === null : /^[a-f0-9]{64}$/.test(row.contentSha256 ?? "")))) {
    throw new Error("invalid PLAN artifact: malformed row");
  }
  const { sha256, ...unsigned } = artifact;
  if (!/^[a-f0-9]{64}$/.test(sha256) || checksumPhase2APlan(unsigned) !== sha256) {
    throw new Error("invalid PLAN artifact checksum");
  }
  return artifact;
}

export function requireReviewedPlanForApply(apply: boolean, artifactPath: string | null): void {
  if (apply && !artifactPath) {
    throw new Error("APPLY refused: --plan-artifact <reviewed PLAN JSON> is required");
  }
}

export function assertArtifactMatchesConfiguration(
  artifact: Phase2APlanArtifact,
  entries: Phase2ARecoveryEntry[],
  minskCityId: string,
): void {
  const configured = new Map(entries.map((entry) => {
    const target = {
      status: "PUBLISHED",
      geoScope: entry.geoScope,
      cityId: entry.geoScope === "CITY" ? minskCityId : null,
    };
    const canonicalPath = entry.geoScope === "CITY"
      ? `/${entry.citySlug}/blog/${entry.currentSlug}`
      : `/blog/${entry.currentSlug}`;
    return [entry.targetArticleId!, { slug: entry.currentSlug, target, canonicalPath }];
  }));
  const artifactIds = artifact.rows.map((row) => row.articleId);
  const uniqueArtifactIds = new Set(artifactIds);
  if (configured.size !== artifact.expectedAutomated ||
      uniqueArtifactIds.size !== artifact.rows.length ||
      configured.size !== uniqueArtifactIds.size ||
      [...configured.keys()].some((id) => !uniqueArtifactIds.has(id)) ||
      artifact.rows.some((row) => {
    const expected = configured.get(row.articleId);
    return !expected || expected.slug !== row.slug || expected.canonicalPath !== row.canonicalPath ||
      expected.target.status !== row.target.status || expected.target.geoScope !== row.target.geoScope ||
      expected.target.cityId !== row.target.cityId;
  })) {
    throw new Error("APPLY refused: reviewed PLAN targets do not match current configuration");
  }
}

export async function createPhase2APlanArtifact(
  prisma: PrismaClient,
  entries: Phase2ARecoveryEntry[],
  minskCityId: string,
  generatedAt = new Date().toISOString(),
): Promise<Phase2APlanArtifact> {
  const rows: Phase2APlanArtifactRow[] = [];
  for (const entry of entries) {
    if (!entry.targetArticleId) throw new Error(`missing audited targetArticleId: ${entry.currentSlug}`);
    const target = {
      status: "PUBLISHED" as const,
      geoScope: entry.geoScope as "CITY" | "COUNTRY",
      cityId: entry.geoScope === "CITY" ? minskCityId : null,
    };
    const canonicalPath = entry.geoScope === "CITY"
      ? `/${entry.citySlug}/blog/${entry.currentSlug}`
      : `/blog/${entry.currentSlug}`;
    const article = await prisma.article.findUnique({ where: { id: entry.targetArticleId }, select: {
      id: true, slug: true, title: true, updatedAt: true, publishedAt: true,
      noindex: true, seoRobots: true, contentJson: true, status: true,
      geoScope: true, cityId: true, regionId: true,
    } });
    if (!article) {
      rows.push({ articleId: entry.targetArticleId, slug: entry.currentSlug, rawTitle: null,
        updatedAt: null, publishedAt: null, noindex: null, seoRobots: null, blocksCount: null,
        contentSha256: null,
        current: { status: null, geoScope: null, cityId: null, regionId: null }, target,
        canonicalPath, legacyUrl: entry.legacySourcePath,
        confidence: entry.confidence as "HIGH" | "MEDIUM", action: "not_found",
        reason: "audited articleId not found" });
      continue;
    }
    const parsedContent = parseArticleContentJson(article.contentJson);
    const blocksCount = parsedContent.blocks.length;
    const contentSha256 = createHash("sha256").update(JSON.stringify(parsedContent)).digest("hex");
    const hasRenderableContent = blocksCount > 0;
    const allowsIndexing = article.noindex !== true && !/\bnoindex\b/i.test(article.seoRobots ?? "");
    const slugMatches = article.slug === entry.currentSlug;
    const matchesTarget = article.status === target.status && article.geoScope === target.geoScope &&
      article.cityId === target.cityId && article.regionId === null;
    const matchesPrecondition = article.status === "PENDING" && article.geoScope === null &&
      article.cityId === null && article.regionId === null;
    rows.push({
      articleId: article.id, slug: entry.currentSlug, rawTitle: article.title,
      updatedAt: article.updatedAt.toISOString(), publishedAt: article.publishedAt?.toISOString() ?? null,
      noindex: article.noindex, seoRobots: article.seoRobots, blocksCount, contentSha256,
      current: { status: article.status, geoScope: article.geoScope, cityId: article.cityId, regionId: article.regionId },
      target, canonicalPath, legacyUrl: entry.legacySourcePath,
      confidence: entry.confidence as "HIGH" | "MEDIUM",
      action: !slugMatches || !hasRenderableContent || !allowsIndexing
        ? "conflict"
        : matchesTarget ? "already_applied" : matchesPrecondition ? "apply" : "conflict",
      ...(!slugMatches ? { reason: `slug/ID mismatch: db=${article.slug} expected=${entry.currentSlug}` } :
        !hasRenderableContent ? { reason: "contentJson has no renderable article blocks" } :
        !allowsIndexing ? { reason: "article is configured noindex" } :
        !matchesTarget && !matchesPrecondition ? { reason: "unexpected current publication/geography state" } : {}),
    });
  }
  return signPhase2APlan({ schema: PHASE_2A_PLAN_SCHEMA, generatedAt, expectedAutomated: entries.length, minskCityId, rows });
}

export function recoveriesFromReviewedArtifact(artifact: Phase2APlanArtifact): MigratedArticlePublicationGeoRecovery[] {
  const blocked = artifact.rows.filter((row) => row.action === "conflict" || row.action === "not_found");
  if (blocked.length > 0) {
    throw new Error(`APPLY refused: reviewed PLAN contains ${blocked.length} conflict/not_found row(s)`);
  }
  return artifact.rows.map((row) => ({
    articleId: row.articleId,
    title: row.rawTitle ?? "",
    auditedTitle: row.rawTitle ?? "",
    currentSlug: row.slug,
    legacyUrl: row.legacyUrl,
    geoScope: row.target.geoScope,
    citySlug: row.target.geoScope === "CITY" ? "minsk" : null,
    confidence: row.confidence,
    reason: `Reviewed PLAN ${artifact.sha256}`,
    expectedUpdatedAt: row.updatedAt ?? "",
    auditedPublishedAt: row.publishedAt,
    auditedNoindex: row.noindex ?? false,
    auditedSeoRobots: row.seoRobots,
    auditedBlocksCount: row.blocksCount ?? 0,
    auditedContentSha256: row.contentSha256 ?? undefined,
  }));
}
