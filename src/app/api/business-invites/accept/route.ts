import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isEmailVerified, jsonEmailNotVerified } from "@/lib/auth/requireVerifiedEmail";
import { acceptBusinessInvite } from "@/server/business/businessInvite.service";

/**
 * POST /api/business-invites/accept — body: { token: string }
 * GET /api/business-invites/accept?token=... — same for email links (MVP JSON response).
 */

async function runAccept(token: string | null) {
  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailVerified(user)) {
    return jsonEmailNotVerified();
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
    return runAccept(token);
  } catch (e) {
    console.error("Accept business invite error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    return runAccept(token);
  } catch (e) {
    console.error("Accept business invite GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
