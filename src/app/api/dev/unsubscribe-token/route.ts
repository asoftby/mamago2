/**
 * Development-only endpoint for testing unsubscribe token generation
 * 
 * GET /api/dev/unsubscribe-token?userId=xxx
 * Returns: { token, url }
 * 
 * SECURITY: This endpoint is STRICTLY development-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createUnsubscribeToken } from "@/lib/auth/unsubscribe-token";
import { buildUnsubscribeUrl } from "@/features/email/lib/unsubscribe-links";

export async function GET(request: NextRequest) {
  // CRITICAL: Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const token = await createUnsubscribeToken(userId);
    const url = await buildUnsubscribeUrl(userId);

    return NextResponse.json({
      userId,
      token,
      url,
      note: "This is a development-only endpoint. Token is opaque and does not expose userId.",
      security: "Token is stored in DB and mapped to userId. URL is safe to share.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}
