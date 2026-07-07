import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  canPerformContentLifecycleOperation,
  type ContentLifecycleOperation,
} from "@/server/services/contentLifecycleOperation.service";

const ALLOWED_OPERATIONS: ContentLifecycleOperation[] = [
  "deleteDraft",
  "deleteArchived",
  "archiveContent",
  "restoreArchived",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const operation = request.nextUrl.searchParams.get(
      "operation",
    ) as ContentLifecycleOperation | null;

    if (!operation || !ALLOWED_OPERATIONS.includes(operation)) {
      return NextResponse.json(
        { error: "Invalid operation" },
        { status: 400 },
      );
    }

    const place = await prisma.place.findUnique({
      where: { id },
      select: { status: true, archivedAt: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const result = await canPerformContentLifecycleOperation({
      contentType: "PLACE",
      contentId: id,
      operation,
      status: place.status,
      archivedAt: place.archivedAt,
      actorRole: user.role,
      prisma,
    });

    return NextResponse.json({
      allowed: result.allowed,
      code: result.code,
      message: result.message,
      reasons: result.reasons,
      dependencySummary: result.dependencySummary,
    });
  } catch (error: unknown) {
    console.error("[lifecycle-preflight] place error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
