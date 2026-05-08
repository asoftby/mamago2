import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resendBusinessInvite } from "@/server/business/businessInvite.service";

/**
 * POST /api/businesses/[businessId]/invites/[inviteId]/resend
 * Resend an active invite email (OWNER only).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; inviteId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId, inviteId } = await params;

    const result = await resendBusinessInvite(user.id, businessId, inviteId);

    if (!result.ok) {
      const status =
        result.code === "NOT_OWNER"
          ? 403
          : result.code === "NOT_FOUND"
            ? 404
            : 400;
      return NextResponse.json({ error: result.code }, { status });
    }

    return NextResponse.json({
      success: true,
      acceptUrl: result.acceptUrl,
      mvpNote: "Email resent successfully",
    });
  } catch (e) {
    console.error("Resend business invite error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
