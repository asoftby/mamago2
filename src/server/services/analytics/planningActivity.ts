/**
 * Shared "meaningful planning action" identity — the single definition of
 * planning-value engagement behind Weekly Planning Families (WPF), W1/W4
 * retention, and the 3-of-4-week habit metric on the /admin dashboard.
 *
 * A qualifying planning action is the union of, always excluding
 * `AUDIENCE_EXCLUDED_ROLES` (ADMIN/MODERATOR, same constant as
 * canonicalAudience.ts):
 *
 *   - `UserEvent` rows with `eventType IN (SAVE, PLAN_ADD)` and a userId.
 *   - `RouteIdea.createdAt` (saving a route to "Ideas" — this write path
 *     fires no UserEvent today, see docs/engineering/backlog.md, so it must
 *     be read from the source table directly).
 *   - `DayScenario.createdAt` OR `updatedAt` (create/modify a Day Scenario;
 *     `updatedAt` only bumps on a real save/override, per
 *     dayScenario.service.ts, so it doubles as "returned to an existing
 *     plan with meaningful interaction").
 *   - `PlanItem` rows with a non-null `routeId` (saving a route into a
 *     dated plan — distinct from the RouteIdea-to-"Ideas" path above).
 *
 * All four sources are userId-keyed with no guest/anonymous concept, so
 * (unlike canonicalAudience.ts's PAGE_VIEW identity) no session-tainting
 * logic is needed — just a plain `User.role` exclusion join.
 *
 * IDENTITY CAVEAT (WPF): every source here is a `userId`. There is no
 * separate "family"/household entity in this codebase (see
 * docs/engineering/backlog.md and the Metric Dictionary entry for
 * `planning.wpf`, which records `identityModel: "ACCOUNT_AS_FAMILY_PROXY"`)
 * — these functions mechanically count/identify distinct accounts, used as
 * a proxy for "families" until a real household model exists.
 *
 * "First qualifying action" (used for habit eligibility) intentionally
 * uses `createdAt` only, not `updatedAt` — an edit to an existing
 * DayScenario is a return visit, not the user's first activation.
 */
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AUDIENCE_EXCLUDED_ROLES } from "./canonicalAudience";

const EXCLUDED_ROLES_SQL_LIST = Prisma.raw(AUDIENCE_EXCLUDED_ROLES.map((role) => `'${role}'`).join(", "));

/** One row per (userId, ts) for every qualifying-action source active in [start, end). */
function qualifyingActionsWindowCte(start: Date, end: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT "userId", "createdAt" AS ts FROM "UserEvent"
      WHERE "eventType" IN ('SAVE', 'PLAN_ADD') AND "userId" IS NOT NULL
        AND "createdAt" >= ${start} AND "createdAt" < ${end}
    UNION ALL
    SELECT "userId", "createdAt" AS ts FROM "RouteIdea"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
    UNION ALL
    SELECT "userId", "createdAt" AS ts FROM "DayScenario"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
    UNION ALL
    SELECT "userId", "updatedAt" AS ts FROM "DayScenario"
      WHERE "updatedAt" >= ${start} AND "updatedAt" < ${end}
    UNION ALL
    SELECT "userId", "createdAt" AS ts FROM "PlanItem"
      WHERE "routeId" IS NOT NULL AND "createdAt" >= ${start} AND "createdAt" < ${end}
  `;
}

/** One row per userId with >=1 qualifying action (by createdAt only — see file header) strictly before `before`. */
function qualifyingActionsBeforeCte(before: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT "userId" FROM "UserEvent"
      WHERE "eventType" IN ('SAVE', 'PLAN_ADD') AND "userId" IS NOT NULL AND "createdAt" < ${before}
    UNION ALL
    SELECT "userId" FROM "RouteIdea" WHERE "createdAt" < ${before}
    UNION ALL
    SELECT "userId" FROM "DayScenario" WHERE "createdAt" < ${before}
    UNION ALL
    SELECT "userId" FROM "PlanItem" WHERE "routeId" IS NOT NULL AND "createdAt" < ${before}
  `;
}

/** Distinct eligible-role users with >=1 qualifying action in [start, end). Used directly by the WPF collector. */
export async function countPlanningActiveUsers(prisma: PrismaClient, start: Date, end: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ active_users: bigint }[]>(Prisma.sql`
    WITH qualifying AS (${qualifyingActionsWindowCte(start, end)}),
    eligible AS (
      SELECT DISTINCT q."userId"
      FROM qualifying q
      LEFT JOIN "User" u ON u.id = q."userId"
      WHERE u.role IS NULL OR u.role NOT IN (${EXCLUDED_ROLES_SQL_LIST})
    )
    SELECT count(*)::bigint AS active_users FROM eligible
  `);
  return Number(rows[0]?.active_users ?? 0);
}

/**
 * Among a specific candidate cohort (already role-filtered by the caller,
 * e.g. a registration-date cohort), how many have >=1 qualifying action in
 * [start, end)? Used by W1/W4 retention. Returns 0 for an empty cohort
 * without querying (callers must still distinguish "empty cohort" from "0
 * retained" upstream — this function only answers the activity question).
 */
export async function countUsersWithPlanningActivity(
  prisma: PrismaClient,
  userIds: string[],
  start: Date,
  end: Date,
): Promise<number> {
  if (userIds.length === 0) return 0;
  const rows = await prisma.$queryRaw<{ active_users: bigint }[]>(Prisma.sql`
    WITH qualifying AS (${qualifyingActionsWindowCte(start, end)})
    SELECT count(DISTINCT q."userId")::bigint AS active_users
    FROM qualifying q
    WHERE q."userId" IN (${Prisma.join(userIds)})
  `);
  return Number(rows[0]?.active_users ?? 0);
}

/**
 * Eligible-role users whose first-ever qualifying action (createdAt only)
 * happened strictly before `before`. Used as the habit-metric denominator
 * ("activated planning families", not "everyone ever registered ≥28d ago").
 */
export async function getEligiblePlanningFamilies(prisma: PrismaClient, before: Date): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ userId: string }[]>(Prisma.sql`
    WITH qualifying AS (${qualifyingActionsBeforeCte(before)}),
    eligible AS (
      SELECT DISTINCT q."userId"
      FROM qualifying q
      LEFT JOIN "User" u ON u.id = q."userId"
      WHERE u.role IS NULL OR u.role NOT IN (${EXCLUDED_ROLES_SQL_LIST})
    )
    SELECT "userId" FROM eligible
  `);
  return new Set(rows.map((r) => r.userId));
}

/**
 * Per eligible-role user, which trailing weekly bucket(s) (0 = most recent
 * 7 days ending `now`, 1 = the 7 days before that, ... up to
 * `bucketCount - 1`) they had >=1 qualifying action in — one query over the
 * full `bucketCount * 7`-day span. Used by the habit collector to compute
 * both the current 3-of-4-week figure (buckets {0,1,2,3}) and its 7-day-
 * shifted comparison (buckets {1,2,3,4}) from a single fetch.
 */
export async function getPlanningActiveUserWeekBuckets(
  prisma: PrismaClient,
  now: Date,
  bucketCount = 5,
): Promise<Map<string, Set<number>>> {
  const spanStart = new Date(now.getTime() - bucketCount * 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<{ userId: string; bucket: number }[]>(Prisma.sql`
    WITH qualifying AS (${qualifyingActionsWindowCte(spanStart, now)}),
    eligible AS (
      SELECT q."userId", q.ts
      FROM qualifying q
      LEFT JOIN "User" u ON u.id = q."userId"
      WHERE u.role IS NULL OR u.role NOT IN (${EXCLUDED_ROLES_SQL_LIST})
    )
    SELECT DISTINCT "userId",
      LEAST(${bucketCount - 1}, FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz - ts)) / (7 * 24 * 60 * 60)))::int AS bucket
    FROM eligible
  `);
  const map = new Map<string, Set<number>>();
  for (const row of rows) {
    const set = map.get(row.userId) ?? new Set<number>();
    set.add(row.bucket);
    map.set(row.userId, set);
  }
  return map;
}
