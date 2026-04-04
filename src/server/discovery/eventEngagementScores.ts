import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Rule-based engagement для ранжирования discovery (UserEvent).
 * SAVE / PLAN_ADD / CTA сильнее просмотров.
 */
export async function getEventEngagementScores(
  activityIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (activityIds.length === 0) return out;

  const rows = await prisma.$queryRaw<Array<{ entityId: string; score: bigint }>>`
    SELECT e."entityId",
      COALESCE(SUM(
        CASE e."eventType"::text
          WHEN 'SAVE' THEN 5
          WHEN 'PLAN_ADD' THEN 4
          WHEN 'CTA_CLICK' THEN 3
          WHEN 'DETAIL_OPEN' THEN 2
          WHEN 'PAGE_VIEW' THEN 2
          WHEN 'CARD_VIEW' THEN 1
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
