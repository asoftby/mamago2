import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { BusinessInviteStatus } from "@prisma/client";
import {
  canListBusinessInvites,
  createBusinessInvite,
  isBusinessOwnerForInvites,
  markExpiredInvites,
} from "@/server/business/businessInvite.service";

/**
 * GET /api/businesses/[businessId]/invites — list invites (OWNER + MANAGER read-only).
 * POST /api/businesses/[businessId]/invites — create invite (OWNER only). MVP role = MANAGER.
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

    if (!(await canListBusinessInvites(user.id, businessId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await prisma.businessInvite.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        title: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const toExpire = rows
      .filter(
        (r) =>
          r.status === BusinessInviteStatus.PENDING && r.expiresAt < now,
      )
      .map((r) => r.id);
    await markExpiredInvites(toExpire);

    const invites = rows.map((r) => ({
      ...r,
      status:
        r.status === BusinessInviteStatus.PENDING && r.expiresAt < now
          ? BusinessInviteStatus.EXPIRED
          : r.status,
    }));

    return NextResponse.json({
      invites,
      mvpNote:
        "Tokens are only returned on create. Configure EMAIL_FROM for real email delivery.",
    });
  } catch (e) {
    console.error("List business invites error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
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

    if (!(await isBusinessOwnerForInvites(user.id, businessId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email : "";
    const position =
      typeof body.position === "string" && body.position.trim() 
        ? body.position.trim() 
        : null;

    const result = await createBusinessInvite({
      businessId,
      email,
      position,
      invitedByUserId: user.id,
    });

    if (!result.ok) {
      const status =
        result.code === "NOT_OWNER"
          ? 403
          : result.code === "INVALID_EMAIL"
            ? 400
            : 409;
      return NextResponse.json({ error: result.code }, { status });
    }

    return NextResponse.json({
      success: true,
      invite: result.invite,
      mvpNote:
        "acceptUrl and token are returned for development/testing; wire transactional email for production.",
    });
  } catch (e) {
    console.error("Create business invite error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
