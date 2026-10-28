import { Prisma } from "@prisma/client";

/**
 * Matches planCountUnit: family if present, otherwise owner.
 * Keep the legacy flag-off behavior (even cancelled rows are counted).
 */
export function planActivityCountsQuery(activityIds: string[], familyReads: boolean): Prisma.Sql {
  if (activityIds.length === 0) {
    // Callers return early; retain a safe no-match query for direct use.
    return Prisma.sql`SELECT "activityId", 0::bigint AS total FROM "PlanItem" WHERE FALSE`;
  }
  const unit = familyReads
    ? Prisma.sql`CASE WHEN "familyId" IS NOT NULL THEN 'f:' || "familyId" ELSE 'u:' || "userId" END`
    : Prisma.sql`"userId"`;
  const active = familyReads
    ? Prisma.sql`AND "status" <> 'CANCELLED'::"PlanDecisionStatus"`
    : Prisma.empty;
  return Prisma.sql`
    SELECT "activityId", COUNT(DISTINCT ${unit})::bigint AS total
    FROM "PlanItem"
    WHERE "activityId" IN (${Prisma.join(activityIds)})
    ${active}
    GROUP BY "activityId"
  `;
}
