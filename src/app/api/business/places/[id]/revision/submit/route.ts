/**
 * POST /api/business/places/[id]/revision/submit
 * Submit revision for moderation
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import {
  checkUserBusinessPermission,
  isPlatformContentStaff,
} from "@/server/permissions/business-permissions";
import { submitPlaceRevisionForModeration } from "@/server/services/placeRevision.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { revisionId, wizardSessionId } = body;

    if (!revisionId) {
      return NextResponse.json(
        { error: "revisionId is required" },
        { status: 400 }
      );
    }

    const revision = await prisma.placeRevision.findUnique({
      where: { id: revisionId },
      select: {
        placeId: true,
        place: {
          select: {
            createdByUserId: true,
            ownerBusinessId: true,
          },
        },
      },
    });

    if (!revision || revision.placeId !== placeId) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    if (!(await canManagePlaceAsync(user, revision.place))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isPlatformContentStaff(user.role)) {
      const businessId = revision.place.ownerBusinessId;
      if (!businessId) {
        return NextResponse.json(
          {
            error: "Место не привязано к бизнес-профилю",
            code: "PLACE_NOT_LINKED_TO_BUSINESS",
          },
          { status: 422 },
        );
      }

      const canPublish = await checkUserBusinessPermission(
        user,
        businessId,
        "content.publish",
      );
      if (!canPublish) {
        return NextResponse.json(
          { error: "Forbidden", code: "BUSINESS_CONTENT_PUBLISH_FORBIDDEN" },
          { status: 403 },
        );
      }

      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { verificationStatus: true },
      });
      if (!business || business.verificationStatus !== "APPROVED") {
        return NextResponse.json(
          {
            error: "Business must be verified before submitting publications",
            code: "BUSINESS_NOT_APPROVED",
          },
          { status: 403 },
        );
      }
    }

    try {
      const submittedRevision = await submitPlaceRevisionForModeration(
        revisionId,
        user,
        wizardSessionId
      );
      return NextResponse.json({
        success: true,
        revision: submittedRevision,
      });
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : "Failed to submit revision";

      if (message.includes("not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes("Unauthorized") || message.includes("not place owner")) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message.includes("Cannot submit revision")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error("Submit revision error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
