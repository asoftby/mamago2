import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ENGAGEMENT_WEIGHTS } from "./engagementWeights";

/**
 * Rule-based engagement для ранжирования discovery (UserEvent).
 * Weights come from the canonical ENGAGEMENT_WEIGHTS table (the single
 * source of truth) — PLAN_ADD outranks SAVE, both outrank passive
 * view/click signals.
 */
export async function getEventEngagementScores(
  activityIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (activityIds.length === 0) return out;

  const weightCases = Object.entries(ENGAGEMENT_WEIGHTS).map(
    ([eventType, weight]) => Prisma.sql`WHEN ${eventType} THEN ${weight}`,
  );

  const rows = await prisma.$queryRaw<Array<{ entityId: string; score: bigint }>>`
    SELECT e."entityId",
      COALESCE(SUM(
        CASE e."eventType"::text
          ${Prisma.join(weightCases, " ")}
          ELSE 0
        END
      ), 0) AS score
    FROM "UserEvent" e
    WHERE e."entityType" = 'EVENT'::"AnalyticsEntityType"
      AND e."entityId" IN (${Prisma.join(activityIds)})
    GROUP BY e."entityId"
  `;

  for (const r of rows) {
    out.set(r.entityId, Number(r.score));
  }
  return out;
}
