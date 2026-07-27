import type { ReadOnlyExtendedClient } from "../user-ownership/readOnlyRepository";

export interface ArticleAuthorshipLineageRow {
  targetType: string;
  targetId: string | null;
  isActive: boolean;
}

export interface UserLineageInfo {
  targetUserId: string | null;
  userExists: boolean;
  userDeleted: boolean;
}

export interface ResolvedArticle {
  id: string;
  authorUserId: string | null;
}

/**
 * The exact, narrow set of reads USERS Slice 17 needs. Every lookup is
 * scoped to an exact `sourceRecordKey` or id — never title/slug/name
 * similarity. Pair with `createReadOnlyPrismaClient` (Slice 6) for the
 * runtime write-guard; this interface additionally makes write methods
 * unreachable through the type system.
 */
export interface ArticleAuthorshipReadOnlyRepository {
  findUserLineage(userSourceRecordKey: string): Promise<UserLineageInfo>;
  findLineageRowsForSourceKey(sourceRecordKey: string): Promise<readonly ArticleAuthorshipLineageRow[]>;
  findArticleById(id: string): Promise<ResolvedArticle | null>;
  findMigrationRecordStatuses(sourceRecordKey: string): Promise<readonly string[]>;
}

export function createArticleAuthorshipReadOnlyRepository(client: ReadOnlyExtendedClient): ArticleAuthorshipReadOnlyRepository {
  return {
    async findUserLineage(userSourceRecordKey) {
      const lineage = await client.migrationLineage.findFirst({
        where: { targetType: "USER", sourceRecordKey: userSourceRecordKey, isActive: true },
        select: { targetId: true },
      });
      const targetUserId = lineage?.targetId ?? null;
      if (!targetUserId) return { targetUserId: null, userExists: false, userDeleted: false };
      const user = await client.user.findUnique({ where: { id: targetUserId }, select: { id: true, deletedAt: true } });
      return { targetUserId, userExists: Boolean(user), userDeleted: Boolean(user?.deletedAt) };
    },

    async findLineageRowsForSourceKey(sourceRecordKey) {
      const rows = await client.migrationLineage.findMany({
        where: { sourceRecordKey },
        select: { targetType: true, targetId: true, isActive: true },
      });
      return rows;
    },

    async findArticleById(id) {
      return client.article.findUnique({ where: { id }, select: { id: true, authorUserId: true } });
    },

    async findMigrationRecordStatuses(sourceRecordKey) {
      const rows = await client.migrationRecord.findMany({ where: { sourceRecordKey }, select: { status: true } });
      return rows.map(row => row.status);
    },
  };
}
