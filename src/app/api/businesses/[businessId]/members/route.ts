import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  assertCanViewTeam,
  getTeamMembersForBusiness,
} from "@/server/business/businessTeam.service";

/**
 * GET /api/businesses/[businessId]/members — OWNER + MANAGER (same as invites list).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId } = await params;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!(await assertCanViewTeam(user.id, businessId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await getTeamMembersForBusiness(businessId);

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        title: m.title,
        isActive: m.isActive,
        createdAt: m.createdAt.toISOString(),
        user: {
          id: m.user.id,
          email: m.user.email,
          displayName: m.user.displayName,
        },
      })),
    });
  } catch (e) {
    console.error("List business members error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
