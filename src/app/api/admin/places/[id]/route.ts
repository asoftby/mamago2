import { NextRequest, NextResponse } from "next/server";
import { ContentStatus, OfferStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";
import { detachImportedRecordsForCatalogEntity } from "@/server/modules/import/services/import-link-reconciliation.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const place = await prisma.place.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        category: true,
        shortDesc: true,
        description: true,
        status: true,
        placeKind: true,
        logoImageId: true,
        lat: true,
        lng: true,
        formattedAddr: true,
        customAddress: true,
        googlePlaceId: true,
        googleRating: true,
        googleUserRatingsTotal: true,
        googleReviewsJson: true,
        locationSource: true,
        phone: true,
        website: true,
        instagramHandle: true,
        ageTags: true,
        visitFormats: true,
        activityTypes: true,
        createdAt: true,
        updatedAt: true,
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        parentPlace: {
          select: {
            id: true,
            title: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            phoneE164: true,
            createdAt: true,
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            kind: true,
            url: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json({ place });
  } catch (error: unknown) {
    console.error("[API] Get place error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/places/[id]
 * Hard-delete an isolated draft place (admin only).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const place = await prisma.place.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        archivedAt: true,
        _count: {
          select: {
            activities: true,
            offers: true,
            bookingRequests: true,
            children: true,
            eventVenues: true,
            routeStops: true,
            reviews: true,
            relatedArticles: true,
            planItems: true,
            placeIdeas: true,
            claimRequests: true,
          },
        },
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const deleteOperation = place.archivedAt ? "deleteArchived" : "deleteDraft";

    await assertContentLifecycleOperationAllowed({
      contentType: "PLACE",
      contentId: id,
      operation: deleteOperation,
      status: place.status,
      archivedAt: place.archivedAt,
      actorRole: user.role,
      prisma,
    });

    await detachImportedRecordsForCatalogEntity(
      {
        entityType: "PLACE",
        entityId: id,
        reason: "Связанный Place был удалён и больше не считается активной сущностью каталога.",
      },
      prisma,
    );

    await prisma.$transaction(async (tx) => {
      await tx.offer.deleteMany({
        where: { placeId: id, status: OfferStatus.DRAFT },
      });

      await tx.activity.deleteMany({
        where: { placeId: id, status: ContentStatus.DRAFT },
      });

      await tx.place.deleteMany({
        where: { parentPlaceId: id, status: ContentStatus.DRAFT },
      });

      await tx.placeImage.deleteMany({
        where: { placeId: id },
      });

      const revisions = await tx.placeRevision.findMany({
        where: { placeId: id },
        select: { id: true },
      });

      for (const revision of revisions) {
        await tx.placeRevisionImage.deleteMany({
          where: { revisionId: revision.id },
        });
      }

      await tx.placeRevision.deleteMany({
        where: { placeId: id },
      });

      await tx.improvementRequest.deleteMany({
        where: {
          entityType: "PLACE",
          entityId: id,
        },
      });

      await tx.moderationLog.deleteMany({
        where: {
          entityType: "PLACE",
          entityId: id,
        },
      });

      const placeWithOpeningHours = await tx.place.findUnique({
        where: { id },
        select: { openingHoursId: true },
      });

      if (placeWithOpeningHours?.openingHoursId) {
        await tx.openingHours.delete({
          where: { id: placeWithOpeningHours.openingHoursId },
        });
      }

      await tx.place.delete({
        where: { id },
      });
    });

    console.log(`[Admin] Place deleted: ${place.title} (${id}) by ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Place deleted successfully",
    });
  } catch (error: unknown) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(error),
        { status: error.statusCode },
      );
    }
    console.error("[API] Delete place error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
