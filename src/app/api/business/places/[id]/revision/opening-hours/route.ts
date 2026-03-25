/**
 * API endpoint for Place Revision Opening Hours
 * PUT - Update opening hours for a place revision
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
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

/**
 * PUT /api/business/places/[id]/revision/opening-hours
 * Update opening hours for a place revision
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await context.params;
    const body = await req.json();
    const { revisionId, data } = body as { 
      revisionId: string; 
      data: OpeningHoursData | null; 
    };

    if (!revisionId) {
      return NextResponse.json(
        { error: "revisionId is required" },
        { status: 400 }
      );
    }

    // Get revision with ownership check
    const revision = await prisma.placeRevision.findUnique({
      where: { id: revisionId },
      include: {
        place: {
          select: {
            id: true,
            ownerUserId: true,
          },
        },
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

    if (!revision) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    // Check ownership
    if (!canManageOwnedContent(user, revision.place.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check revision status - only allow editing DRAFT and NEEDS_REVISION
    if (revision.status !== "DRAFT" && revision.status !== "NEEDS_REVISION") {
      return NextResponse.json(
        { error: `Cannot edit revision in status: ${revision.status}` },
        { status: 400 }
      );
    }

    // If data is null, delete existing opening hours from revision
    if (!data) {
      if (revision.openingHoursId) {
        await prisma.openingHours.delete({
          where: { id: revision.openingHoursId },
        });

        await prisma.placeRevision.update({
          where: { id: revisionId },
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

    if (revision.openingHoursId) {
      // Update existing opening hours
      const updatePayload = mapToUpdatePayload(data);
      openingHours = await prisma.openingHours.update({
        where: { id: revision.openingHoursId },
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
      // Create new opening hours for revision
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

      // Link to revision
      await prisma.placeRevision.update({
        where: { id: revisionId },
        data: { openingHoursId: openingHours.id },
      });
    }

    return NextResponse.json({
      success: true,
      openingHours,
    });
  } catch (error) {
    console.error("[PUT /api/business/places/[id]/revision/opening-hours] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}