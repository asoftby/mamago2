import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  createImprovementRequest,
  getActiveImprovementRequestForEntity,
  listImprovementRequestsForEntity,
  resolveImprovementRequest,
  cancelImprovementRequest,
} from "@/server/services/improvementRequest.service";
import { ImprovementSeverity } from "@prisma/client";
import prisma from "@/lib/prisma";
import { notifyPlaceImprovementRequested } from "@/server/services/notification.service";

/**
 * GET /api/admin/places/[id]/improvement-request
 * List improvement requests for a place
 * Query params:
 * - includeResolved: include resolved/cancelled requests
 * - activeOnly: return only the single active request (if exists)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeResolved = searchParams.get("includeResolved") === "true";
    const activeOnly = searchParams.get("activeOnly") === "true";

    // If activeOnly, return just the single active request
    if (activeOnly) {
      const activeRequest = await getActiveImprovementRequestForEntity("PLACE", id);
      return NextResponse.json({ 
        activeRequest,
        hasActiveRequest: !!activeRequest,
      });
    }

    // Otherwise return full list
    const requests = await listImprovementRequestsForEntity(
      "PLACE",
      id,
      includeResolved
    );

    return NextResponse.json({ requests });
  } catch (error: unknown) {
    console.error("[API] List improvement requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/places/[id]/improvement-request
 * Create an improvement request for a published place
 * ENFORCES: Only ONE active improvement request per place
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { severity, title, description, requestedChanges, dueAt } = body;

    if (!severity || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: severity, title, description" },
        { status: 400 }
      );
    }

    // Validate severity
    if (!Object.values(ImprovementSeverity).includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity: ${severity}` },
        { status: 400 }
      );
    }

    // Get place to find owner
    const place = await prisma.place.findUnique({
      where: { id },
      select: { title: true, status: true, ownerBusiness: { select: { ownerUserId: true } } },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (place.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Can only create improvement requests for published places" },
        { status: 400 }
      );
    }

    // ImprovementRequest.assignedToUserId references User.id, never Business.id.
    // Without a linked business, sending a "successful" request is misleading.
    const ownerUserId = place.ownerBusiness?.ownerUserId;
    if (!ownerUserId) {
      return NextResponse.json(
        { error: "К месту не привязан бизнес. Нельзя отправить замечание владельцу." },
        { status: 422 },
      );
    }

    const request = await createImprovementRequest({
      entityType: "PLACE",
      entityId: id,
      createdByModeratorId: user.id,
      assignedToUserId: ownerUserId,
      severity,
      title,
      description,
      requestedChanges,
      dueAt: dueAt ? new Date(dueAt) : undefined,
    });

    // Keep the business action even if notification infrastructure is unavailable,
    // but tell the moderator rather than silently reporting delivery as successful.
    let notificationCreated = false;
    try {
      await notifyPlaceImprovementRequested({
        placeId: id,
        placeName: place.title,
        requestId: request.id,
        ownerUserId,
        requestTitle: request.title,
        requestDescription: request.description,
      });
      notificationCreated = true;
    } catch (notificationError) {
      console.error("[API] Improvement request notification creation failed", {
        requestId: request.id,
        notificationError,
      });
    }

    return NextResponse.json({ request, notificationCreated }, { status: 201 });
  } catch (error: unknown) {
    console.error("[API] Create improvement request error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Handle the specific case where an active request already exists
    if (errorMessage.startsWith("ACTIVE_REQUEST_EXISTS:")) {
      return NextResponse.json(
        {
          error: "ACTIVE_REQUEST_EXISTS",
          message: errorMessage.replace("ACTIVE_REQUEST_EXISTS: ", ""),
        },
        { status: 409 } // 409 Conflict
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/places/[id]/improvement-request
 * Resolve or cancel an improvement request
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await params; // Await params even if not used for consistency
    const body = await req.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: requestId, action" },
        { status: 400 }
      );
    }

    let request;
    if (action === "resolve") {
      request = await resolveImprovementRequest(requestId);
    } else if (action === "cancel") {
      request = await cancelImprovementRequest(requestId);
    } else {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ request });
  } catch (error: unknown) {
    console.error("[API] Update improvement request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
