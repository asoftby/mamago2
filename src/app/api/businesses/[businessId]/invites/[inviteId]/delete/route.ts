import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteBusinessInvite } from "@/server/business/businessInvite.service";

/**
 * DELETE /api/businesses/[businessId]/invites/[inviteId]/delete
 * Delete an inactive invite from history (OWNER only).
 * Cannot delete active PENDING invites - they must be revoked first.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; inviteId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId, inviteId } = await params;

    const result = await deleteBusinessInvite(user.id, businessId, inviteId);

    if (!result.ok) {
      const status =
        result.code === "NOT_OWNER"
          ? 403
          : result.code === "NOT_FOUND"
            ? 404
            : 400;
      return NextResponse.json({ error: result.code }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete business invite error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
