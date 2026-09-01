/**
 * API endpoint for Place Opening Hours
 * GET - Get opening hours for a place
 * PUT - Update opening hours for a place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  mapToCreatePayload,
  mapToUpdatePayload,
  validateOpeningHours,
} from "@/lib/openingHours";
import type { OpeningHoursData } from "@/components/openingHours";

import { canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { canEditPendingPlace } from "@/lib/permissions/placeEditPermissions";

/**
 * GET /api/business/places/[id]/opening-hours
 * Get opening hours for a place
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await context.params;

    // Get place with opening hours
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        createdByUserId: true,
        ownerBusinessId: true,
        openingHours: {
          include: {
            rules: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            exceptions: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check ownership
    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      openingHours: place.openingHours,
    });
  } catch (error) {
    console.error("[GET /api/business/places/[id]/opening-hours] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business/places/[id]/opening-hours
 * Update opening hours for a place
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await context.params;
    const body = await req.json();
    const { data } = body as { data: OpeningHoursData | null };

    // Get place
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        ownerBusinessId: true,
        openingHoursId: true,
        status: true, // Add status to check if place is published
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const isAdminOrModerator = user.role === "ADMIN" || user.role === "MODERATOR";

    // Admins/moderators can edit any place directly; others need ownership
    if (!isAdminOrModerator) {
      if (!place.ownerBusinessId || !canManageOwnedContent(user, place.ownerBusinessId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // A PENDING place is under moderation review — same staff-only rule
      // as the plain PATCH endpoint (src/app/api/business/places/[id]/route.ts),
      // reusing the exact same helper so the two never drift into different
      // policies. Must run before the data === null delete branch below —
      // otherwise the owner could delete a PENDING place's schedule via a
      // null-data PUT even though they can't edit it any other way.
      if (place.status === "PENDING" && !canEditPendingPlace(user.role)) {
        return NextResponse.json(
          {
            error: "PENDING_PLACE_REQUIRES_STAFF",
            message: "Pending places can only be edited by staff (ADMIN/MODERATOR) while under moderation review.",
          },
          { status: 403 }
        );
      }
      // For published places, non-admins must use the revision flow
      if (place.status === "PUBLISHED") {
        return NextResponse.json(
          {
            error: "Cannot edit opening hours for published place directly. Use revision API instead.",
            code: "USE_REVISION_API",
          },
          { status: 400 }
        );
      }
    }

    // If data is null, delete existing opening hours
    if (!data) {
      if (place.openingHoursId) {
        await prisma.openingHours.delete({
          where: { id: place.openingHoursId },
        });

        await prisma.place.update({
          where: { id: placeId },
          data: { openingHoursId: null },
        });
      }

      return NextResponse.json({
        success: true,
        openingHours: null,
      });
    }

    // Validate data
    const validation = validateOpeningHours(data);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    let openingHours;

    if (place.openingHoursId) {
      // Update existing opening hours
      const updatePayload = mapToUpdatePayload(data);
      openingHours = await prisma.openingHours.update({
        where: { id: place.openingHoursId },
        data: updatePayload,
        include: {
          rules: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          exceptions: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });
    } else {
      // Create new opening hours
      const createPayload = mapToCreatePayload(data);
      openingHours = await prisma.openingHours.create({
        data: createPayload,
        include: {
          rules: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          exceptions: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });

      // Link to place
      await prisma.place.update({
        where: { id: placeId },
        data: { openingHoursId: openingHours.id },
      });
    }

    return NextResponse.json({
      success: true,
      openingHours,
    });
  } catch (error) {
    console.error("[PUT /api/business/places/[id]/opening-hours] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
