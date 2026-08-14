import type { MigrationTargetType, PrismaClient } from "@prisma/client";
import type { NormalizedArticleCandidate } from "../../adapters/wordpress-db/normalizeArticle";
import { buildArticleCreateDraft } from "../../commit/article/buildArticleCreateDraft";
import { ArticleCommitWriter } from "../../commit/article/ArticleCommitWriter";
import { MigrationLineageWriter } from "../../lineage/MigrationLineageWriter";
import type { LineageOnlyTargetState } from "./lineageOnlyPlanner";
import type { ArticlesMigrationCandidate, ArticlesMigrationWriteResult } from "./articlesAdapter";

const ARTICLE_TARGET_TYPE: MigrationTargetType = "ARTICLE";

export interface ArticlesTargetStatePrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
  article: Pick<PrismaClient["article"], "findUnique">;
}

export function createArticlesTargetStateResolver(
  prisma: ArticlesTargetStatePrismaClient,
  sourceId: string,
): (candidate: ArticlesMigrationCandidate) => Promise<LineageOnlyTargetState> {
  return async (candidate) => {
    const lineages = await prisma.migrationLineage.findMany({
      where: { sourceId, sourceRecordKey: candidate.sourceRecordKey, targetType: ARTICLE_TARGET_TYPE, targetRole: "primary", isActive: true },
    });
    if (lineages.length !== 1) {
      return { lineageCount: lineages.length, targetExists: false, lineageDomainHash: lineages[0]?.lastSourceHash ?? null };
    }
    const targetId = lineages[0].targetId;
    const target = targetId ? await prisma.article.findUnique({ where: { id: targetId }, select: { id: true } }) : null;
    return { lineageCount: 1, targetExists: Boolean(target), lineageDomainHash: lineages[0].lastSourceHash };
  };
}

/** Implemented by FrozenArticleSourceRepository; never backed by WordPress. */
export interface RawArticleSourceRepository {
  loadNormalizedCandidate(sourceRecordKey: string): NormalizedArticleCandidate;
}

export interface ArticlesWriteTransactionClient {
  article: Pick<PrismaClient["article"], "create" | "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "create" | "updateMany" | "findUnique" | "findUniqueOrThrow">;
}

export interface ArticlesWriterPrismaClient {
  $transaction<T>(fn: (tx: ArticlesWriteTransactionClient) => Promise<T>): Promise<T>;
}

export function createArticlesWriter(
  prisma: ArticlesWriterPrismaClient,
  rawSource: RawArticleSourceRepository,
  sourceId: string,
): (candidate: ArticlesMigrationCandidate) => Promise<ArticlesMigrationWriteResult> {
  return async (candidate) => {
    const rawCandidate = rawSource.loadNormalizedCandidate(candidate.sourceRecordKey);

    const built = buildArticleCreateDraft({ candidate: rawCandidate, context: {} });
    if (!built.ok) throw new Error(`ARTICLE_DRAFT_INVALID:${built.reasons.map((reason) => reason.code).join("+")}`);

    return prisma.$transaction(async (tx) => {
      const writer = new ArticleCommitWriter(tx);
      const written = await writer.createArticleFromDraft(built.draft);
      if (!written.ok) throw new Error(written.errorMessage);

      const lineageWriter = new MigrationLineageWriter(tx);
      await lineageWriter.createLineage({
        sourceId,
        sourceEntityType: "wordpress-db:post",
        sourceStableKey: candidate.sourceRecordKey,
        sourceRecordKey: candidate.sourceRecordKey,
        targetType: ARTICLE_TARGET_TYPE,
        targetId: written.articleId,
        targetStableKey: written.articleId,
        lastSourceHash: candidate.domainHash,
      });

      return { targetId: written.articleId };
    });
  };
}
