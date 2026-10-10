/**
 * Клиент сообщает, какие элементы запуска рекомендаций реально показаны (после клиентского фильтра и
 * обрезки), чтобы в аналитике экспозиции не завышались. Сейчас поддерживается только блок
 * «Похожие события» на странице события.
 */
import { NextRequest, NextResponse } from "next/server";
import { AnalyticsEntityType } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { SIMILAR_EVENTS_INTENT } from "@/lib/event/loadSimilarActivities";
import {
  NARROW_EXPOSURES_MAX_IDS,
  narrowRunExposuresToShown,
} from "@/server/services/recommendations/RecommendationTraceService";

const bodySchema = z.object({
  runId: z.string().min(1).max(64),
  entityIds: z.array(z.string().min(1).max(64)).max(NARROW_EXPOSURES_MAX_IDS),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const result = await narrowRunExposuresToShown({
      runId: parsed.data.runId,
      entityType: AnalyticsEntityType.EVENT,
      shownEntityIds: parsed.data.entityIds,
      actorUserId: user?.id ?? null,
      intent: SIMILAR_EVENTS_INTENT,
    });

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : result.reason === "invalid" ? 400 : 403;
      return NextResponse.json({ error: result.reason }, { status });
    }
    return NextResponse.json({ ok: true, kept: result.kept, removed: result.removed });
  } catch (error) {
    console.error("[API] POST /api/recommendations/exposures/shown error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
