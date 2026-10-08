import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getCurrentAuthState } from "@/lib/auth/getCurrentAuthState";
import { prisma } from "@/lib/prisma";
import { buildMeProfileUpdateData } from "@/lib/account/buildMeProfileUpdateData";

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function GET() {
  try {
    const authState = await getCurrentAuthState();
    if (!authState) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(authState);
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

    const updateData = buildMeProfileUpdateData(body);

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
