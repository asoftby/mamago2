import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const business = await getMyBusiness(user.id);
    const hasApprovedBusinessProfile = business
      ? getEffectiveVerificationStatus(business) === "APPROVED"
      : false;

    return NextResponse.json({
      ...user,
      hasApprovedBusinessProfile,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/me
 * Update current authenticated user profile
 */
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const updateData: Record<string, unknown> = {};

    if (typeof body.displayName === "string") {
      updateData.displayName = body.displayName.trim();
    }

    if (typeof body.familyRole === "string") {
      updateData.familyRole = body.familyRole || null;
    }

    if (typeof body.ageBandLabel === "string") {
      updateData.ageBandLabel = body.ageBandLabel || null;
    }

    if (Array.isArray(body.preferenceSignalIds)) {
      updateData.preferenceSignalIds = body.preferenceSignalIds;
    }

    if (typeof body.leisureFormatSignalId === "string" || body.leisureFormatSignalId === null) {
      updateData.leisureFormatSignalId = body.leisureFormatSignalId;
    }

    if (typeof body.preferenceSummary === "string" || body.preferenceSummary === null) {
      updateData.preferenceSummary = body.preferenceSummary;
    }

    if (typeof body.leisureFormatSummary === "string" || body.leisureFormatSummary === null) {
      updateData.leisureFormatSummary = body.leisureFormatSummary;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      familyRole: updated.familyRole,
      ageBandLabel: updated.ageBandLabel,
      preferenceSummary: updated.preferenceSummary,
      leisureFormatSummary: updated.leisureFormatSummary,
      preferenceSignalIds: updated.preferenceSignalIds,
      leisureFormatSignalId: updated.leisureFormatSignalId,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
