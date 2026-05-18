/**
 * HTTP API для first-party продуктовой телеметрии (UserEvent).
 * Путь `/api/analytics/events` — историческое имя; не связан с cookie-категорией «внешняя аналитика».
 * См. docs/cookies-and-telemetry.md.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  AnalyticsEntityType,
  AnalyticsVertical,
  UserEventType,
} from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";

const analyticsMetaSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .refine(
    (value) => value == null || JSON.stringify(value).length <= 4096,
    "meta_too_large",
  );

const bodySchema = z.object({
  eventType: z.nativeEnum(UserEventType),
  entityType: z.nativeEnum(AnalyticsEntityType).optional().nullable(),
  entityId: z.string().optional().nullable(),
  vertical: z.nativeEnum(AnalyticsVertical).optional().nullable(),
  cityId: z.string().optional().nullable(),
  citySlug: z.string().optional().nullable(),
  meta: analyticsMetaSchema.optional(),
  sessionId: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const sessionRowId = await getSessionRowIdFromCookies();
    const body = parsed.data;

    const sessionId =
      body.sessionId?.trim() ||
      sessionRowId ||
      null;

    await trackUserEvent({
      userId: user?.id ?? null,
      sessionId,
      eventType: body.eventType,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      vertical: body.vertical ?? null,
      cityId: body.cityId ?? null,
      citySlug: body.citySlug ?? null,
      meta: body.meta ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[product-telemetry] POST /api/analytics/events:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
