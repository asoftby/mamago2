import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getCurrentAuthState } from "@/lib/auth/getCurrentAuthState";
import { prisma } from "@/lib/prisma";
import { buildMeProfileUpdateData } from "@/lib/account/buildMeProfileUpdateData";
import { resolveAvatarUrlUpdate } from "@/lib/account/resolveAvatarUrlUpdate";

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

    // Avatar: only the user's own uploaded media (or null to remove).
    // One indexed lookup (uploadedById) and only when avatarUrl is sent.
    const avatarUpdate = await resolveAvatarUrlUpdate(body, async (url) => {
      const asset = await prisma.mediaAsset.findFirst({
        where: { uploadedById: user.id, publicUrl: url, status: { notIn: ["DELETED", "BLOCKED"] } },
        select: { id: true },
      });
      return !!asset;
    });
    if (avatarUpdate.kind === "invalid") {
      return NextResponse.json({ error: "Не удалось сохранить фото" }, { status: 400 });
    }
    if (avatarUpdate.kind === "set") updateData.avatarUrl = avatarUpdate.avatarUrl;

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
