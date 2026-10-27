/**
 * Canonical mamaGo audience identity — the ONE shared definition of "a
 * visitor" AND "a product page view" for a PAGE_VIEW reporting window,
 * used by every consumer that needs a visitor/DAU/WAU/MAU/pageViews count
 * (Traffic block, audience.dau/wau/mau collectors, /admin/performance).
 * Introduced to fix a documented inconsistency: Traffic's "unique
 * visitors" counted DISTINCT PAGE_VIEW sessionId while DAU/WAU/MAU counted
 * DISTINCT userId over ALL UserEvent types — two incompatible populations
 * displayed side by side — and later extended because raw page views still
 * included 100% internal ADMIN/MODERATOR traffic even after visitors
 * excluded it, making views/visitor meaningless on internal-only days.
 *
 * Scope: `UserEvent.eventType = 'PAGE_VIEW'` only. Non-PAGE_VIEW telemetry
 * (CARD_VIEW, SAVE, ...) never contributes here.
 *
 * Visitors (unchanged by the pageViews extension):
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
 *
 * Product page views — the SAME eligibility contract applied per row, via
 * per-session "tainted" classification rather than a second independent
 * filter:
 *   - A session linked, in-window, to ANY excluded-role (ADMIN/MODERATOR)
 *     userId is "tainted" — EVERY PAGE_VIEW row from that session is
 *     excluded, including anonymous-looking rows recorded before that
 *     login (an admin's pre-login browsing on the same session is still
 *     the admin's traffic, not a separate anonymous visitor's).
 *   - A session that is never tainted (whether truly anonymous-only, or
 *     linked only to an eligible USER/BUSINESS_OWNER) has ALL its
 *     PAGE_VIEW rows counted — including anonymous-before-login rows on a
 *     session that later authenticates as an eligible user, since those
 *     rows are part of that same eligible visitor's product journey.
 *   - A row with no sessionId counts only if its own userId is eligible
 *     (present, role outside AUDIENCE_EXCLUDED_ROLES).
 *   - A row with neither sessionId nor userId never counts.
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
  /** PAGE_VIEW rows belonging to an eligible canonical visitor — see file header. */
  pageViews: number;
  /**
   * DISTINCT sessionId among those eligible PAGE_VIEW rows — «Устройства»
   * (`mg_analytics_sid` is a persistent per-browser id, NOT a 30-minute
   * session; real sessions are BACKLOG-211).
   */
  devices: number;
}

/**
 * Optional narrowing used by `/admin/analytics` filters. Applied to the
 * PAGE_VIEW population BEFORE the identity rules, so the same contract holds
 * inside the narrowed slice. Omitted = the global /admin definition.
 */
export interface CanonicalAudienceOptions {
  /** Only PAGE_VIEW rows written with this cityId (B3). */
  cityId?: string | null;
  /**
   * Only rows of these users (segment / child-age filters). Anonymous rows
   * can never match a user filter, so only authenticated visitors remain.
   * An empty set yields zeros.
   */
  allowedUserIds?: ReadonlySet<string> | null;
}

interface CanonicalAudienceRow {
  authenticated_visitors: bigint;
  anonymous_only_visitors: bigint;
  eligible_page_views: bigint;
  devices: bigint;
}

const EXCLUDED_ROLES_SQL_LIST = Prisma.raw(
  AUDIENCE_EXCLUDED_ROLES.map((role) => `'${role}'`).join(", "),
);

export async function computeCanonicalAudience(
  prisma: PrismaClient,
  start: Date,
  end: Date,
  options: CanonicalAudienceOptions = {},
): Promise<CanonicalAudienceCounts> {
  const allowed = options.allowedUserIds ?? null;
  if (allowed && allowed.size === 0) {
    return { authenticatedVisitors: 0, anonymousOnlyVisitors: 0, visitors: 0, pageViews: 0, devices: 0 };
  }
  const cityFilter = options.cityId ? Prisma.sql`AND "cityId" = ${options.cityId}` : Prisma.empty;
  const userFilter = allowed ? Prisma.sql`AND "userId" IN (${Prisma.join([...allowed])})` : Prisma.empty;
  const rows = await prisma.$queryRaw<CanonicalAudienceRow[]>(Prisma.sql`
    WITH pv AS (
      SELECT id, "userId", "sessionId"
      FROM "UserEvent"
      WHERE "eventType" = 'PAGE_VIEW' AND "createdAt" >= ${start} AND "createdAt" < ${end}
        ${cityFilter}
        ${userFilter}
    ),
    session_user_roles AS (
      -- One row per (session, role-of-a-linked-user) pair — a session can
      -- appear more than once here only if it was somehow linked to more
      -- than one distinct userId in-window, which the taint check below
      -- treats conservatively (any excluded-role link taints the session).
      SELECT DISTINCT e."sessionId", u.role
      FROM "UserEvent" e
      JOIN "User" u ON u.id = e."userId"
      WHERE e."sessionId" IS NOT NULL AND e."userId" IS NOT NULL
        AND e."createdAt" >= ${start} AND e."createdAt" < ${end}
        AND e."sessionId" IN (SELECT "sessionId" FROM pv WHERE "sessionId" IS NOT NULL)
    ),
    linked_sessions AS (
      SELECT DISTINCT "sessionId" FROM session_user_roles
    ),
    tainted_sessions AS (
      SELECT DISTINCT "sessionId" FROM session_user_roles WHERE role IN (${EXCLUDED_ROLES_SQL_LIST})
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
    ),
    eligible_page_views AS (
      SELECT pv.id, pv."sessionId"
      FROM pv
      WHERE
        (pv."sessionId" IS NOT NULL AND pv."sessionId" NOT IN (SELECT "sessionId" FROM tainted_sessions))
        OR
        (pv."sessionId" IS NULL AND pv."userId" IN (SELECT "userId" FROM authenticated))
    )
    SELECT
      (SELECT count(*) FROM authenticated)::bigint AS authenticated_visitors,
      (SELECT count(*) FROM anonymous_only)::bigint AS anonymous_only_visitors,
      (SELECT count(*) FROM eligible_page_views)::bigint AS eligible_page_views,
      (SELECT count(DISTINCT "sessionId") FROM eligible_page_views)::bigint AS devices
  `);

  const row = rows[0];
  const authenticatedVisitors = Number(row?.authenticated_visitors ?? 0);
  const anonymousOnlyVisitors = Number(row?.anonymous_only_visitors ?? 0);
  return {
    authenticatedVisitors,
    anonymousOnlyVisitors,
    visitors: authenticatedVisitors + anonymousOnlyVisitors,
    pageViews: Number(row?.eligible_page_views ?? 0),
    devices: Number(row?.devices ?? 0),
  };
}

/**
 * Internal-traffic exclusion for ANY UserEvent query (ТЗ «Аналитика
 * админки», B1) — the same contract as the PAGE_VIEW identity above, applied
 * to every event type:
 *
 *   - rows of users whose role is in AUDIENCE_EXCLUDED_ROLES are excluded;
 *   - rows of a "tainted" session — a sessionId linked IN THE WINDOW (by any
 *     event type) to an excluded-role user — are excluded entirely, including
 *     anonymous rows recorded before that login (an admin browsing the site
 *     before signing in is still admin traffic).
 *
 * Resolved once per report into two small id lists (staff accounts and
 * their sessions are few), so the same rule can be expressed both as a
 * Prisma `where` and as a raw-SQL predicate without drifting apart.
 */
export interface InternalTrafficExclusion {
  excludedUserIds: string[];
  taintedSessionIds: string[];
}

export async function resolveInternalTrafficExclusion(
  prisma: PrismaClient,
  start: Date,
  end: Date,
): Promise<InternalTrafficExclusion> {
  const [users, sessions] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [...AUDIENCE_EXCLUDED_ROLES] } },
      select: { id: true },
    }),
    prisma.$queryRaw<{ sessionId: string }[]>(Prisma.sql`
      SELECT DISTINCT e."sessionId"
      FROM "UserEvent" e
      JOIN "User" u ON u.id = e."userId"
      WHERE e."sessionId" IS NOT NULL
        AND u.role IN (${EXCLUDED_ROLES_SQL_LIST})
        AND e."createdAt" >= ${start} AND e."createdAt" < ${end}
    `),
  ]);
  return {
    excludedUserIds: users.map((u) => u.id),
    taintedSessionIds: sessions.map((r) => r.sessionId),
  };
}

/** Prisma `UserEvent` filter for {@link InternalTrafficExclusion}. NULL userId/sessionId rows are kept. */
export function internalTrafficExclusionWhere(exclusion: InternalTrafficExclusion): Prisma.UserEventWhereInput {
  const and: Prisma.UserEventWhereInput[] = [];
  if (exclusion.excludedUserIds.length > 0) {
    and.push({ OR: [{ userId: null }, { userId: { notIn: exclusion.excludedUserIds } }] });
  }
  if (exclusion.taintedSessionIds.length > 0) {
    and.push({ OR: [{ sessionId: null }, { sessionId: { notIn: exclusion.taintedSessionIds } }] });
  }
  return and.length > 0 ? { AND: and } : {};
}

/** Raw-SQL predicate for {@link InternalTrafficExclusion} on a `"UserEvent"` alias. */
export function internalTrafficExclusionSql(exclusion: InternalTrafficExclusion, alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  const parts: Prisma.Sql[] = [];
  if (exclusion.excludedUserIds.length > 0) {
    parts.push(Prisma.sql`(${a}."userId" IS NULL OR ${a}."userId" NOT IN (${Prisma.join(exclusion.excludedUserIds)}))`);
  }
  if (exclusion.taintedSessionIds.length > 0) {
    parts.push(
      Prisma.sql`(${a}."sessionId" IS NULL OR ${a}."sessionId" NOT IN (${Prisma.join(exclusion.taintedSessionIds)}))`,
    );
  }
  return parts.length > 0 ? Prisma.join(parts, " AND ") : Prisma.sql`TRUE`;
}
