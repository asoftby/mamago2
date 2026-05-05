import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { buildEmptyPublicationStats } from "@/lib/publication-stats/empty";
import {
  DEFAULT_PUBLICATION_STATS_PERIOD,
  parsePublicationStatsPeriod,
} from "@/lib/publication-stats/period";
import { canViewPublicationStats } from "@/lib/publication-stats/visibility";

/**
 * GET /api/publication-stats/[entityId]?path=&period=
 * Статистика публикации — admin и business owner (этап 1).
 * Данные: реальный агрегатор ещё не подключён, поэтому возвращаем честное пустое состояние.
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
  const periodRaw = url.searchParams.get("period");
  const period =
    parsePublicationStatsPeriod(periodRaw) ?? DEFAULT_PUBLICATION_STATS_PERIOD;

  const payload = buildEmptyPublicationStats(entityId, path, user, period);
  console.log("[API] real data used", {
    endpoint: "/api/publication-stats/[entityId]",
    empty: true,
  });
  return NextResponse.json(payload);
}
