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
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { ensurePublishedActivityHasSlug } from "@/lib/slug/publishSlugGuards";
import { resolveCanonicalEventPublicPathById } from "@/lib/business/resolveCanonicalEventPublicPath";

/**
 * POST /api/business/events/[id]/submit
 * Submit event for moderation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    await replaceActivitySessionsFromScheduleJson(existing.id, existing.scheduleJson);

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
    const sessions = await prisma.activitySession.count({
      where: {
        activityId: id,
      },
    });

    if (sessions === 0) {
      errors.push("Добавьте хотя бы одну дату проведения");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors },
        { status: 400 }
      );
    }

    if (existing.title?.trim()) {
      await assignActivitySlugIfMissing(id, existing.title.trim());
    }

    const sessionRows = await prisma.activitySession.findMany({
      where: { activityId: id },
      orderBy: { startsAt: "asc" },
    });
    const now = new Date();
    const nextUp = sessionRows.find((s) => s.startsAt >= now);
    const nextOccurrenceAt = nextUp?.startsAt ?? null;

    const nextStatus = canPublishContentDirectly(user.role)
      ? ContentStatus.PUBLISHED
      : existing.status === ContentStatus.PUBLISHED
        ? ContentStatus.PENDING_UPDATE
        : ContentStatus.PENDING;

    const event = await prisma.activity.update({
      where: {
        id,
      },
      data: {
        status: nextStatus,
        nextOccurrenceAt,
      },
    });

    if (event.status === ContentStatus.PUBLISHED) {
      await ensurePublishedActivityHasSlug(event.id);
    }

    const slugRow = await prisma.activity.findUnique({
      where: { id: event.id },
      select: { slug: true },
    });
    const publicPath = await resolveCanonicalEventPublicPathById(event.id);

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        slug: slugRow?.slug ?? null,
        publicPath,
      },
    });
  } catch (error: unknown) {
    console.error("Submit event error:", error);
    const message = error instanceof Error ? error.message : "Failed to submit event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
