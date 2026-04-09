import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { revokeBusinessInvite } from "@/server/business/businessInvite.service";

/**
 * POST /api/businesses/[businessId]/invites/[inviteId]/revoke — OWNER only.
 */

export async function POST(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ businessId: string; inviteId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId, inviteId } = await params;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const result = await revokeBusinessInvite(user.id, businessId, inviteId);

    if (!result.ok) {
      if (result.code === "NOT_OWNER") {
        return NextResponse.json({ error: result.code }, { status: 403 });
      }
      if (result.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.code }, { status: 404 });
      }
      return NextResponse.json({ error: result.code }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Revoke business invite error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
