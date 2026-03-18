import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, ContentStatus } from "@prisma/client";

/**
 * POST /api/business/events/[id]/submit
 * Submit event for moderation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify ownership
    const existing = await prisma.activity.findFirst({
      where: {
        id: params.id,
        ownerUserId: user.id,
        type: ActivityType.EVENT,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

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
        activityId: params.id,
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

    // Update status to PENDING_REVIEW
    const event = await prisma.activity.update({
      where: {
        id: params.id,
      },
      data: {
        status: ContentStatus.PENDING,
      },
    });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
      },
    });
  } catch (error: any) {
    console.error("Submit event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit event" },
      { status: 500 }
    );
  }
}
