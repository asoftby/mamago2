import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, ContentStatus } from "@prisma/client";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import {
  canCreateBusinessContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { ensurePublishedActivityHasSlug } from "@/lib/slug/publishSlugGuards";
import { resolveCanonicalEventPublicPathById } from "@/lib/business/resolveCanonicalEventPublicPath";
import { resolvePendingLocationOnPublish } from "@/lib/business/resolvePendingLocationOnPublish";
import { assignSlugOnPublish } from "@/lib/slug/placeSlugService";
import { createPublishTimer, runAfterPublishResponse } from "@/server/utils/publishPipeline";

/**
 * POST /api/business/events/[id]/submit
 * Submit event for moderation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = createPublishTimer("publish:event");
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.activity.findFirst({
      where: {
        id,
        type: ActivityType.EVENT,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }
    timer.mark("db");

    // Validate required fields
    const errors: string[] = [];

    if (!existing.title || existing.title.trim().length < 3) {
      errors.push("Название должно содержать минимум 3 символа");
    }

    if (!existing.shortDesc || existing.shortDesc.trim().length < 10) {
      errors.push("Краткое описание должно содержать минимум 10 символов");
    }

    if (!existing.description || existing.description.trim().length < 20) {
      errors.push("Полное описание должно содержать минимум 20 символов");
    }

    if (!existing.coverImageId) {
      errors.push("Загрузите главное изображение");
    }

    if (!existing.ageTags || existing.ageTags.length === 0) {
      errors.push("Выберите возраст");
    }

    // Check sessions
    const now = new Date();
    const [sessionsCount, nextUpcomingSession] = await Promise.all([
      prisma.activitySession.count({
        where: {
          activityId: id,
        },
      }),
      prisma.activitySession.findFirst({
        where: {
          activityId: id,
          startsAt: { gte: now },
        },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true },
      }),
    ]);

    if (sessionsCount === 0) {
      errors.push("Добавьте хотя бы одну дату проведения");
    }
    timer.mark("validate");

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors },
        { status: 400 }
      );
    }

    if (existing.title?.trim()) {
      await assignActivitySlugIfMissing(id, existing.title.trim());
    }

    const nextOccurrenceAt = nextUpcomingSession?.startsAt ?? null;

    const nextStatus = canPublishContentDirectly(user.role)
      ? ContentStatus.PUBLISHED
      : existing.status === ContentStatus.PUBLISHED
        ? ContentStatus.PENDING_UPDATE
        : ContentStatus.PENDING;

    // Резолвим pendingLocation и при необходимости создаём Place — всё в одной транзакции
    const scheduleJson =
      existing.scheduleJson && typeof existing.scheduleJson === "object" && !Array.isArray(existing.scheduleJson)
        ? (existing.scheduleJson as Record<string, unknown>)
        : {};

    const { placeId: resolvedPlaceId, placeCreated } =
      await prisma.$transaction(async (tx) => {
        const result = await resolvePendingLocationOnPublish(
          tx,
          id,
          scheduleJson,
          user.id,
          existing.businessId ?? null,
        );

        await tx.activity.update({
          where: { id },
          data: {
            status: nextStatus,
            nextOccurrenceAt,
            scheduleJson: result.updatedScheduleJson as never,
            ...(result.placeId !== null ? { placeId: result.placeId } : {}),
          },
        });

        return result;
      });
    timer.mark("status");

    // Назначаем slug новому Place (вне транзакции — идемпотентно)
    if (placeCreated && resolvedPlaceId) {
      runAfterPublishResponse("publish:event", "assign place slug", () =>
        assignSlugOnPublish(resolvedPlaceId),
      );
    }

    const event = await prisma.activity.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        slug: true,
      },
    });

    if (event.status === ContentStatus.PUBLISHED && !event.slug) {
      await ensurePublishedActivityHasSlug(event.id);
    }

    const publicPath = await resolveCanonicalEventPublicPathById(event.id);
    timer.mark("response");
    timer.log({ status: event.status, placeCreated: placeCreated ? 1 : 0 });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        slug: event.slug ?? null,
        publicPath,
      },
    });
  } catch (error: unknown) {
    timer.log({ error: 1 });
    console.error("Submit event error:", error);
    const message = error instanceof Error ? error.message : "Failed to submit event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
