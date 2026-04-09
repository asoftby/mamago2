import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { deactivateBusinessMember } from "@/server/business/businessTeam.service";

/**
 * POST /api/businesses/[businessId]/members/[memberId]/deactivate — OWNER only; MANAGER target only.
 */

export async function POST(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ businessId: string; memberId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId, memberId } = await params;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const result = await deactivateBusinessMember(user.id, businessId, memberId);

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
    console.error("Deactivate business member error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
