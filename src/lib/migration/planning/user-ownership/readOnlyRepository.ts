import type { MigrationTargetType, PrismaClient } from "@prisma/client";

/**
 * USERS Slice 6 is a fully read-only planning slice: no `create`, `update`,
 * `upsert`, `delete`, `deleteMany`, or raw-write call is permitted anywhere
 * in this module tree, including tests. Relying on convention ("just don't
 * call write methods") is explicitly not enough per the task brief, so this
 * file provides two independent, redundant guards:
 *
 * 1. A Prisma Client Extension (`createReadOnlyPrismaClient`) that
 *    intercepts every model operation and every `$executeRaw*` call and
 *    throws `ReadOnlyViolationError` *before* the underlying query function
 *    runs — i.e. before the database is touched at all.
 * 2. A narrow TypeScript repository interface
 *    (`UserOwnershipReadOnlyRepository`) that only exposes the specific
 *    read operations the planners need, so write methods are not even
 *    reachable through the type system from planner code.
 */

const FORBIDDEN_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "deleteManyAndReturn",
]);

export class ReadOnlyViolationError extends Error {
  constructor(operation: string) {
    super(`USERS Slice 6 read-only guard: operation "${operation}" is forbidden. This analyzer must never write to the database.`);
    this.name = "ReadOnlyViolationError";
  }
}

/**
 * Wraps a real `PrismaClient` in an extension that rejects every write
 * operation and every raw-execute call before it reaches the database.
 * Read operations (`findMany`, `findUnique`, `findFirst`, `count`,
 * `groupBy`, `aggregate`, `$queryRaw`, `$queryRawUnsafe`) pass through
 * unchanged.
 */
export function createReadOnlyPrismaClient(prisma: PrismaClient) {
  return prisma.$extends({
    name: "users-slice6-read-only-guard",
    client: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must accept the tagged-template args Prisma's real $executeRaw takes, even though this override always rejects.
      async $executeRaw(...args: unknown[]): Promise<never> {
        throw new ReadOnlyViolationError("$executeRaw");
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must accept the args Prisma's real $executeRawUnsafe takes, even though this override always rejects.
      async $executeRawUnsafe(...args: unknown[]): Promise<never> {
        throw new ReadOnlyViolationError("$executeRawUnsafe");
      },
    },
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (FORBIDDEN_OPERATIONS.has(operation)) throw new ReadOnlyViolationError(operation);
          return query(args);
        },
      },
    },
  });
}

export type ReadOnlyExtendedClient = ReturnType<typeof createReadOnlyPrismaClient>;

export interface BaselineCounts {
  user: number;
  session: number;
  userActionToken: number;
  business: number;
  place: number;
  offer: number;
  article: number;
  route: number;
  activity: number;
  mediaAsset: number;
  migrationLineage: number;
  migrationRecord: number;
}

export interface PlaceOwnershipRow {
  ownerBusinessId: string | null;
  createdByUserId: string;
}

/**
 * The exact, narrow set of reads USERS Slice 6 planners need. Every method
 * name here is a read; there is no way to reach a write method through
 * this interface, independent of the runtime guard above.
 */
export interface UserOwnershipReadOnlyRepository {
  captureBaselineCounts(): Promise<BaselineCounts>;
  roleStatusDistribution(): Promise<ReadonlyArray<{ role: string; status: string; count: number }>>;
  findLineageTargetIds(targetType: MigrationTargetType, sourceRecordKeys: readonly string[]): Promise<ReadonlyMap<string, string>>;
  findPlaceOwnership(placeIds: readonly string[]): Promise<ReadonlyMap<string, PlaceOwnershipRow>>;
  findBusinessOwners(businessIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  findArticleAuthors(articleIds: readonly string[]): Promise<ReadonlyMap<string, string | null>>;
  findRouteAuthors(routeIds: readonly string[]): Promise<ReadonlyMap<string, string | null>>;
  findActivityOwners(activityIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export function createUserOwnershipReadOnlyRepository(client: ReadOnlyExtendedClient): UserOwnershipReadOnlyRepository {
  return {
    async captureBaselineCounts() {
      const [user, session, userActionToken, business, place, offer, article, route, activity, mediaAsset, migrationLineage, migrationRecord] = await Promise.all([
        client.user.count(),
        client.session.count(),
        client.userActionToken.count(),
        client.business.count(),
        client.place.count(),
        client.offer.count(),
        client.article.count(),
        client.route.count(),
        client.activity.count(),
        client.mediaAsset.count(),
        client.migrationLineage.count(),
        client.migrationRecord.count(),
      ]);
      return { user, session, userActionToken, business, place, offer, article, route, activity, mediaAsset, migrationLineage, migrationRecord };
    },

    async roleStatusDistribution() {
      const rows = await client.user.groupBy({ by: ["role", "status"], _count: { _all: true } });
      return rows.map(row => ({ role: row.role, status: row.status, count: row._count._all })).sort((a, b) => (a.role + a.status < b.role + b.status ? -1 : 1));
    },

    async findLineageTargetIds(targetType, sourceRecordKeys) {
      if (sourceRecordKeys.length === 0) return new Map();
      const rows = await client.migrationLineage.findMany({
        where: { targetType, isActive: true, sourceRecordKey: { in: [...sourceRecordKeys] } },
        select: { sourceRecordKey: true, targetId: true },
      });
      const map = new Map<string, string>();
      for (const row of rows) if (row.targetId) map.set(row.sourceRecordKey, row.targetId);
      return map;
    },

    async findPlaceOwnership(placeIds) {
      if (placeIds.length === 0) return new Map();
      const rows = await client.place.findMany({ where: { id: { in: [...placeIds] } }, select: { id: true, ownerBusinessId: true, createdByUserId: true } });
      return new Map(rows.map(row => [row.id, { ownerBusinessId: row.ownerBusinessId, createdByUserId: row.createdByUserId }]));
    },

    async findBusinessOwners(businessIds) {
      if (businessIds.length === 0) return new Map();
      const rows = await client.business.findMany({ where: { id: { in: [...businessIds] } }, select: { id: true, ownerUserId: true } });
      return new Map(rows.map(row => [row.id, row.ownerUserId]));
    },

    async findArticleAuthors(articleIds) {
      if (articleIds.length === 0) return new Map();
      const rows = await client.article.findMany({ where: { id: { in: [...articleIds] } }, select: { id: true, authorUserId: true } });
      return new Map(rows.map(row => [row.id, row.authorUserId]));
    },

    async findRouteAuthors(routeIds) {
      if (routeIds.length === 0) return new Map();
      const rows = await client.route.findMany({ where: { id: { in: [...routeIds] } }, select: { id: true, authorId: true } });
      return new Map(rows.map(row => [row.id, row.authorId]));
    },

    async findActivityOwners(activityIds) {
      if (activityIds.length === 0) return new Map();
      const rows = await client.activity.findMany({ where: { id: { in: [...activityIds] } }, select: { id: true, ownerUserId: true } });
      return new Map(rows.map(row => [row.id, row.ownerUserId]));
    },
  };
}
