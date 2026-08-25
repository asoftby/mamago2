/**
 * Canonical mamaGo audience identity — the ONE shared definition of "a
 * visitor" for a PAGE_VIEW reporting window, used by every consumer that
 * needs a visitor/DAU/WAU/MAU count (Traffic block, audience.dau/wau/mau
 * collectors, /admin/performance). Introduced to fix a documented
 * inconsistency: Traffic's "unique visitors" counted DISTINCT PAGE_VIEW
 * sessionId while DAU/WAU/MAU counted DISTINCT userId over ALL UserEvent
 * types — two incompatible populations displayed side by side.
 *
 * Scope: `UserEvent.eventType = 'PAGE_VIEW'` only. Non-PAGE_VIEW telemetry
 * (CARD_VIEW, SAVE, ...) never contributes to audience identity here.
 *
 * Identity:
 *   visitors = DISTINCT authenticated userId (role outside
 *              AUDIENCE_EXCLUDED_ROLES)
 *            + DISTINCT sessionId that is NEVER linked, within the same
 *              window, to ANY userId — authenticated OR excluded-role. A
 *              session that ever authenticates, even as ADMIN/MODERATOR,
 *              must never fall back into the anonymous bucket; it is
 *              simply dropped if that user's role is excluded.
 *
 * Deliberately NOT a row-by-row COALESCE(userId, sessionId): that would
 * double-count a visitor who starts anonymous and logs in within the same
 * window (their pre-login sessionId row and post-login userId row would
 * both be counted as separate visitors).
 */
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

/**
 * Internal staff roles excluded from canonical product audience metrics.
 * Ordinary USER and BUSINESS_OWNER accounts are never excluded —
 * BUSINESS_OWNER browsing public pages is legitimate product traffic
 * (their `/business/*` activity isn't PAGE_VIEW-tracked at all, so this
 * only ever counts their public-site browsing).
 */
export const AUDIENCE_EXCLUDED_ROLES = ["ADMIN", "MODERATOR"] as const;

export interface CanonicalAudienceCounts {
  authenticatedVisitors: number;
  anonymousOnlyVisitors: number;
  visitors: number;
}

interface CanonicalAudienceRow {
  authenticated_visitors: bigint;
  anonymous_only_visitors: bigint;
}

const EXCLUDED_ROLES_SQL_LIST = Prisma.raw(
  AUDIENCE_EXCLUDED_ROLES.map((role) => `'${role}'`).join(", "),
);

export async function computeCanonicalAudience(
  prisma: PrismaClient,
  start: Date,
  end: Date,
): Promise<CanonicalAudienceCounts> {
  const rows = await prisma.$queryRaw<CanonicalAudienceRow[]>(Prisma.sql`
    WITH pv AS (
      SELECT "userId", "sessionId"
      FROM "UserEvent"
      WHERE "eventType" = 'PAGE_VIEW' AND "createdAt" >= ${start} AND "createdAt" < ${end}
    ),
    linked_sessions AS (
      SELECT DISTINCT "sessionId" FROM pv WHERE "sessionId" IS NOT NULL AND "userId" IS NOT NULL
    ),
    authenticated AS (
      SELECT DISTINCT pv."userId"
      FROM pv
      LEFT JOIN "User" u ON u.id = pv."userId"
      -- u.role IS NULL covers a userId whose User row no longer exists
      -- (e.g. account deleted within the window) — treated as included
      -- rather than silently dropped, since its role can't be excluded.
      WHERE pv."userId" IS NOT NULL
        AND (u.role IS NULL OR u.role NOT IN (${EXCLUDED_ROLES_SQL_LIST}))
    ),
    anonymous_only AS (
      SELECT DISTINCT pv."sessionId"
      FROM pv
      WHERE pv."sessionId" IS NOT NULL
        AND pv."sessionId" NOT IN (SELECT "sessionId" FROM linked_sessions)
    )
    SELECT
      (SELECT count(*) FROM authenticated)::bigint AS authenticated_visitors,
      (SELECT count(*) FROM anonymous_only)::bigint AS anonymous_only_visitors
  `);

  const row = rows[0];
  const authenticatedVisitors = Number(row?.authenticated_visitors ?? 0);
  const anonymousOnlyVisitors = Number(row?.anonymous_only_visitors ?? 0);
  return {
    authenticatedVisitors,
    anonymousOnlyVisitors,
    visitors: authenticatedVisitors + anonymousOnlyVisitors,
  };
}
