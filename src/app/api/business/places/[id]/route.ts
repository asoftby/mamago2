/**
 * PATCH /api/business/places/[id] - Update Place (autosave-friendly)
 * GET /api/business/places/[id] - Get Place details
 * DELETE /api/business/places/[id] - Delete Place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { getActiveRevision } from "@/server/services/placeRevision.service";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { assignPlaceSlugIfMissing } from "@/lib/slug/placeSlugService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_ID", message: "Place ID is required" },
        { status: 400 }
      );
    }

    const place = await prisma.place.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
        subcategories: {
          orderBy: { position: "asc" },
          select: { categoryId: true, position: true },
        },
        parentPlace: {
          select: {
            id: true,
            title: true,
            formattedAddr: true,
          },
        },
        children: {
          select: {
            id: true,
            title: true,
            unitLabel: true,
            status: true,
          },
        },
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        districtAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        districtManual: {
          select: {
            id: true,
            name: true,
          },
        },
        metroAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        metroManual: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check access using business-based ownership
    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get active revision if Place is published
    let activeRevision = null;
    if (place.status === "PUBLISHED") {
      activeRevision = await getActiveRevision(place.id);
    }

    return NextResponse.json({ 
      place,
      activeRevision,
    });
  } catch (error) {
    console.error("[place-get] ❌ Error:", error);
    console.error("[place-get] Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { 
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to get place"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_ID", message: "Place ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const existing = await prisma.place.findUnique({
      where: { id },
      select: { 
        createdByUserId: true,
        ownerBusinessId: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    // Check access using business-based ownership
    const canManage = await canManagePlaceAsync(user, existing);
    if (!canManage) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 }
      );
    }

    // If Place is PUBLISHED, edits must go through PlaceRevision
    if (existing.status === "PUBLISHED") {
      return NextResponse.json(
        { 
          error: "PUBLISHED_PLACE_REQUIRES_REVISION",
          message: "Published places must be edited through revisions. Use /api/business/places/[id]/revision endpoint."
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Lenient validation for autosave - only check types/formats
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = String(body.title);
    if (body.category !== undefined) updateData.category = String(body.category);
    if (body.shortDesc !== undefined) updateData.shortDesc = String(body.shortDesc);
    if (body.description !== undefined) updateData.description = body.description ? String(body.description) : null;
    if (body.logoImageId !== undefined) updateData.logoImageId = body.logoImageId;
    if (body.phone !== undefined) updateData.phone = body.phone ? String(body.phone) : null;
    if (body.website !== undefined) updateData.website = body.website ? String(body.website) : null;
    if (body.instagramHandle !== undefined) updateData.instagramHandle = body.instagramHandle ? String(body.instagramHandle) : null;
    if (body.instagramUrl !== undefined) updateData.instagramUrl = body.instagramUrl ? String(body.instagramUrl) : null;
    if (body.ageTags !== undefined) updateData.ageTags = Array.isArray(body.ageTags) ? body.ageTags : [];
    if (body.visitFormats !== undefined) updateData.visitFormats = Array.isArray(body.visitFormats) ? body.visitFormats : [];
    if (body.placeKind !== undefined) updateData.placeKind = body.placeKind;
    if (body.parentPlaceId !== undefined) updateData.parentPlaceId = body.parentPlaceId;
    if (body.floor !== undefined) updateData.floor = body.floor ? String(body.floor) : null;
    if (body.unit !== undefined) updateData.unit = body.unit ? String(body.unit) : null;
    if (body.unitLabel !== undefined) updateData.unitLabel = body.unitLabel ? String(body.unitLabel) : null;
    if (body.primaryCategoryId !== undefined) updateData.primaryCategoryId = body.primaryCategoryId || null;
    if (body.discoverySignalIds !== undefined) updateData.discoverySignalIds = Array.isArray(body.discoverySignalIds) ? body.discoverySignalIds : [];

    // Log for debugging
    console.log("[place-patch] Update data:", updateData);

    const place = await prisma.place.update({
      where: { id },
      data: updateData,
    });

    // Update subcategories if provided
    if (Array.isArray(body.subcategoryIds)) {
      const subcategoryIds: string[] = body.subcategoryIds.slice(0, 3);
      await prisma.placeSubcategory.deleteMany({ where: { placeId: id } });
      if (subcategoryIds.length > 0) {
        await prisma.placeSubcategory.createMany({
          data: subcategoryIds.map((categoryId: string, position: number) => ({
            placeId: id,
            categoryId,
            position,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Auto-assign slug on first meaningful title fill (idempotent).
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (t) {
        await assignPlaceSlugIfMissing(id, t);
      }
    }

    return NextResponse.json({ place });
  } catch (error) {
    console.error("[place-patch] ❌ Error:", error);
    console.error("[place-patch] Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { 
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to update place"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_ID", message: "Place ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const existing = await prisma.place.findUnique({
      where: { id },
      select: { 
        createdByUserId: true,
        ownerBusinessId: true,
        placeKind: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    // Check access using business-based ownership
    const canManage = await canManagePlaceAsync(user, existing);
    if (!canManage) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 }
      );
    }

    // Check if COMPLEX has children
    if (existing.placeKind === "COMPLEX") {
      const childrenCount = await prisma.place.count({
        where: { parentPlaceId: id },
      });

      if (childrenCount > 0) {
        return NextResponse.json(
          { 
            error: "HAS_CHILDREN",
            message: "Cannot delete complex with units. Delete units first." 
          },
          { status: 400 }
        );
      }
    }

    await prisma.place.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[place-delete] ❌ Error:", error);
    console.error("[place-delete] Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { 
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to delete place"
      },
      { status: 500 }
    );
  }
}
