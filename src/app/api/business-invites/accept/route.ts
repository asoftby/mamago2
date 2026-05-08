import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  acceptBusinessInvite,
  buildBusinessInviteAcceptPath,
} from "@/server/business/businessInvite.service";

/**
 * POST /api/business-invites/accept — JSON endpoint for authenticated client requests.
 * GET /api/business-invites/accept?token=... — legacy invite links redirect to the public page.
 */

async function runAcceptApi(token: string | null) {
  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await acceptBusinessInvite(user, token.trim());

  if (!result.ok) {
    const map: Record<typeof result.code, number> = {
      INVITE_NOT_FOUND: 404,
      EMAIL_MISMATCH: 403,
      NOT_PENDING: 400,
      EXPIRED: 400,
      REVOKED: 400,
    };
    return NextResponse.json({ error: result.code }, { status: map[result.code] });
  }

  return NextResponse.json({
    success: true,
    businessId: result.businessId,
    alreadyMember: result.alreadyMember === true,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : null;
    return runAcceptApi(token);
  } catch (error) {
    console.error("Accept business invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  const redirectUrl = new URL(buildBusinessInviteAcceptPath(token ?? ""), request.url);
  return NextResponse.redirect(redirectUrl, 307);
}
