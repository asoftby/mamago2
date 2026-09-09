import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { buildEmptyPublicationStats } from "@/lib/publication-stats/empty";
import {
  DEFAULT_PUBLICATION_STATS_PERIOD,
  parsePublicationStatsPeriod,
} from "@/lib/publication-stats/period";
import { canViewPublicationStats } from "@/lib/publication-stats/visibility";
import { getArticlePerformanceStats } from "@/server/services/analytics/articlePerformanceStats.service";

/**
 * GET /api/publication-stats/[entityId]?path=&period=
 *
 * Article reports are real for ADMIN. BUSINESS_OWNER keeps the existing safe
 * empty contract until a sponsored-project/ownership relation explicitly grants
 * that business access to a particular editorial article.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ entityId: string }> }
) {
  const { entityId } = await context.params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  if (!canViewPublicationStats(user.role as Role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? `/minsk/events/${entityId}`;
  const period = parsePublicationStatsPeriod(url.searchParams.get("period"))
    ?? DEFAULT_PUBLICATION_STATS_PERIOD;

  if (user.role === "ADMIN") {
    const articleStats = await getArticlePerformanceStats(entityId, period);
    if (articleStats) return NextResponse.json(articleStats);
  }

  return NextResponse.json(buildEmptyPublicationStats(entityId, path, user, period));
}
