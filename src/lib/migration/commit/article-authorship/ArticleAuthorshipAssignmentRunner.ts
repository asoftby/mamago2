import type { PrismaClient } from "@prisma/client";

export const USER_575_SOURCE_RECORD_KEY = "wordpress-db:user:575";
export const USER_575_ARTICLE_SOURCE_RECORD_KEYS = [
  "wordpress-db:post:56250",
  "wordpress-db:post:57731",
] as const;

export type User575ArticleSourceRecordKey = (typeof USER_575_ARTICLE_SOURCE_RECORD_KEYS)[number];
export type ArticleAuthorshipAssignmentAction = "ASSIGNED" | "ALREADY_SATISFIED";

type TransactionClient = Pick<PrismaClient, "migrationLineage" | "user" | "article">;

export interface ArticleAuthorshipAssignmentPrismaClient extends TransactionClient {
  $transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export interface ArticleAuthorshipAssignmentResult {
  sourceRecordKey: User575ArticleSourceRecordKey;
  articleId: string;
  targetUserId: string;
  action: ArticleAuthorshipAssignmentAction;
}

function blocked(code: string, detail: string): never {
  throw new Error(`${code}:${detail}`);
}

async function assertAndAssignOne(
  tx: TransactionClient,
  sourceRecordKey: User575ArticleSourceRecordKey,
): Promise<ArticleAuthorshipAssignmentResult> {
  const userLineages = await tx.migrationLineage.findMany({
    where: {
      sourceRecordKey: USER_575_SOURCE_RECORD_KEY,
      targetType: "USER",
      isActive: true,
    },
    select: { targetId: true },
  });
  if (userLineages.length !== 1 || !userLineages[0]?.targetId) {
    blocked("AUTHORSHIP_USER_LINEAGE_MISMATCH", `${USER_575_SOURCE_RECORD_KEY}:${userLineages.length}`);
  }
  const targetUserId = userLineages[0].targetId;
  const targetUser = await tx.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, deletedAt: true },
  });
  if (!targetUser || targetUser.deletedAt) {
    blocked("AUTHORSHIP_TARGET_USER_MISMATCH", targetUserId);
  }

  const lineageRows = await tx.migrationLineage.findMany({
    where: { sourceRecordKey },
    select: { targetType: true, targetId: true, isActive: true },
  });
  const activeArticleLineages = lineageRows.filter((row) => row.targetType === "ARTICLE" && row.isActive);
  const otherActiveLineages = lineageRows.filter((row) => row.targetType !== "ARTICLE" && row.isActive);
  if (activeArticleLineages.length !== 1 || otherActiveLineages.length !== 0) {
    blocked(
      "AUTHORSHIP_ARTICLE_LINEAGE_MISMATCH",
      `${sourceRecordKey}:article=${activeArticleLineages.length}:other=${otherActiveLineages.length}`,
    );
  }
  const articleId = activeArticleLineages[0]?.targetId;
  if (!articleId) {
    blocked("AUTHORSHIP_ARTICLE_TARGET_MISSING", sourceRecordKey);
  }
  const article = await tx.article.findUnique({
    where: { id: articleId },
    select: { id: true, authorUserId: true },
  });
  if (!article) {
    blocked("AUTHORSHIP_ARTICLE_TARGET_MISSING", `${sourceRecordKey}:${articleId}`);
  }
  if (article.authorUserId === targetUserId) {
    return { sourceRecordKey, articleId, targetUserId, action: "ALREADY_SATISFIED" };
  }
  if (article.authorUserId !== null) {
    blocked("AUTHORSHIP_EXISTING_AUTHOR_CONFLICT", `${sourceRecordKey}:${article.authorUserId}`);
  }

  const updated = await tx.article.updateMany({
    where: { id: articleId, authorUserId: null },
    data: { authorUserId: targetUserId },
  });
  if (updated.count !== 1) {
    blocked("AUTHORSHIP_CAS_MISMATCH", `${sourceRecordKey}:${articleId}:${updated.count}`);
  }
  return { sourceRecordKey, articleId, targetUserId, action: "ASSIGNED" };
}

export class ArticleAuthorshipAssignmentRunner {
  constructor(private readonly prisma: ArticleAuthorshipAssignmentPrismaClient) {}

  async executeOne(sourceRecordKey: User575ArticleSourceRecordKey): Promise<ArticleAuthorshipAssignmentResult> {
    if (!USER_575_ARTICLE_SOURCE_RECORD_KEYS.includes(sourceRecordKey)) {
      blocked("AUTHORSHIP_SOURCE_SCOPE_MISMATCH", sourceRecordKey);
    }
    return this.prisma.$transaction((tx) => assertAndAssignOne(tx, sourceRecordKey));
  }

  async executeBatch(): Promise<readonly ArticleAuthorshipAssignmentResult[]> {
    const results: ArticleAuthorshipAssignmentResult[] = [];
    for (const sourceRecordKey of USER_575_ARTICLE_SOURCE_RECORD_KEYS) {
      results.push(await this.executeOne(sourceRecordKey));
    }
    return results;
  }
}
