import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, ContentStatus, Prisma } from "@prisma/client";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import {
  canCreateBusinessContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { ensurePublishedActivityHasSlug } from "@/lib/slug/publishSlugGuards";
import { revalidateEventMutationPaths } from "@/lib/business/eventMutationSideEffects";
import { resolvePendingLocationOnPublish } from "@/lib/business/resolvePendingLocationOnPublish";
import { assignSlugOnPublish } from "@/lib/slug/placeSlugService";
import { runAfterPublishResponse } from "@/server/utils/publishPipeline";
import { createRequestPerf } from "@/server/utils/requestPerf";
import {
  activitySessionsMatchScheduleJson,
  replaceActivitySessionsFromScheduleJson,
} from "@/lib/business/syncEventActivitySessions";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";
import { syncEventHomeStories } from "@/server/stories/homeStoryItems";

/**
 * POST /api/business/events/[id]/submit
 * Submit event for moderation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perf = createRequestPerf("publish:event:submit");
  try {
    const { id } = await params;
    perf.mark("parse-params");

    const user = await getCurrentUser();
    perf.mark("auth");

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
    perf.mark("access-check");

    const existing = await prisma.activity.findFirst({
      where: {
        id,
        type: ActivityType.EVENT,
      },
      select: {
        id: true,
        title: true,
        shortDesc: true,
        description: true,
        coverImageId: true,
        ageTags: true,
        scheduleJson: true,
        businessId: true,
        status: true,
        slug: true,
        nextOccurrenceAt: true,
      },
    });
    perf.mark("fetch-existing");

    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

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

    perf.mark("validate-fields");

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors },
        { status: 400 }
      );
    }

    const scheduleJsonForSync =
      existing.scheduleJson && typeof existing.scheduleJson === "object" && !Array.isArray(existing.scheduleJson)
        ? (existing.scheduleJson as Record<string, unknown>)
        : {};

    let sessionSyncRan = false;
    if (
      !(await activitySessionsMatchScheduleJson({
        prisma,
        activityId: id,
        scheduleJson: scheduleJsonForSync,
      }))
    ) {
      await replaceActivitySessionsFromScheduleJson({
        prisma,
        activityId: id,
        scheduleJson: scheduleJsonForSync,
      });
      sessionSyncRan = true;
      perf.mark("session-sync");
    } else {
      perf.mark("session-sync");
    }

    const now = new Date();
    const sessionsCount = await prisma.activitySession.count({
      where: { activityId: id },
    });

    const nextUpcomingSession = await prisma.activitySession.findFirst({
      where: {
        activityId: id,
        startsAt: { gte: now },
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true },
    });

    if (sessionsCount === 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: ["Добавьте хотя бы одну дату проведения"],
        },
        { status: 400 }
      );
    }
    perf.mark("validate-sessions");

    const nextOccurrenceAt = nextUpcomingSession?.startsAt ?? null;

    if (!existing.slug?.trim() && existing.title?.trim()) {
      await assignActivitySlugIfMissing(id, existing.title.trim());
      perf.mark("slug-pre-tx");
    } else {
      perf.mark("slug-pre-tx");
    }

    const nextStatus = canPublishContentDirectly(user.role)
      ? ContentStatus.PUBLISHED
      : existing.status === ContentStatus.PUBLISHED
        ? ContentStatus.PENDING_UPDATE
        : ContentStatus.PENDING;

    const { placeId: resolvedPlaceId, placeCreated } = await prisma.$transaction(async (tx) => {
      const resolved = await resolvePendingLocationOnPublish(
        tx,
        id,
        scheduleJsonForSync,
        user.id,
        existing.businessId ?? null,
      );

      const nextOccurrenceChanged =
        (existing.nextOccurrenceAt?.getTime() ?? null) !== (nextOccurrenceAt?.getTime() ?? null);

      const scheduleChanged =
        stableJsonStringify(existing.scheduleJson) !==
        stableJsonStringify(resolved.updatedScheduleJson as unknown);

      const updateData: Prisma.ActivityUncheckedUpdateInput = {
        status: nextStatus,
        ...(resolved.placeId !== null ? { placeId: resolved.placeId } : {}),
      };

      if (nextOccurrenceChanged) {
        updateData.nextOccurrenceAt = nextOccurrenceAt;
      }
      if (scheduleChanged) {
        updateData.scheduleJson = resolved.updatedScheduleJson as Prisma.InputJsonValue;
      }

      await tx.activity.update({
        where: { id },
        data: updateData,
      });

      return { placeId: resolved.placeId, placeCreated: resolved.placeCreated };
    });
    perf.mark("tx-publish");

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
    perf.mark("fetch-result");

    if (event.status === ContentStatus.PUBLISHED && !event.slug) {
      await ensurePublishedActivityHasSlug(event.id);
      perf.mark("slug-ensure-published");
    } else {
      perf.mark("slug-ensure-published");
    }

    await syncEventHomeStories(event.id);
    const { publicPath } = await revalidateEventMutationPaths(event.id, "publish");
    perf.mark("revalidate");

    perf.mark("response-sent");
    perf.log({
      eventId: event.id,
      status: event.status,
      placeCreated: placeCreated ? 1 : 0,
      sessionSyncRan: sessionSyncRan ? 1 : 0,
    });

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
    perf.log({ error: 1 });
    console.error("Submit event error:", error);
    return NextResponse.json({ error: "Failed to submit event" }, { status: 500 });
  }
}
