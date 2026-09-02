/** POST /api/business/places/[id]/claim */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isEmailVerified, jsonEmailNotVerified } from "@/lib/auth/requireVerifiedEmail";
import prisma from "@/lib/prisma";
import { getUserBusinessId } from "@/lib/auth/placeAccess";
import { checkUserBusinessPermission } from "@/server/permissions/business-permissions";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: placeId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isEmailVerified(user)) return jsonEmailNotVerified();

    const businessId = await getUserBusinessId(user.id);
    if (!businessId) {
      return NextResponse.json(
        { error: "Business required. You must have a business to claim a place." },
        { status: 403 },
      );
    }
    if (!(await checkUserBusinessPermission(user, businessId, "content.create"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { id: true, title: true, ownerBusinessId: true, createdByUserId: true },
    });
    if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });

    if (place.ownerBusinessId === businessId) {
      return NextResponse.json(
        { error: "Your business already owns this place" },
        { status: 400 },
      );
    }

    const existingRequest = await prisma.placeClaimRequest.findFirst({
      where: { placeId, businessId, status: "PENDING" },
    });
    if (existingRequest) {
      return NextResponse.json({
        ok: true,
        requestId: existingRequest.id,
        message: "Request already exists",
      });
    }

    const claimRequest = await prisma.placeClaimRequest.create({
      data: { placeId, userId: user.id, businessId, status: "PENDING" },
    });

    return NextResponse.json({
      ok: true,
      requestId: claimRequest.id,
      message: "Claim request created",
    });
  } catch (error) {
    console.error("[API] Place claim error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
