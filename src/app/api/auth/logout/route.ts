import { NextRequest, NextResponse } from "next/server";
import {
  getSessionToken,
  deleteSession,
  deleteSessionCookieAction,
} from "@/lib/auth/session";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";

export async function POST(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(/:$/u, "");

  const redirectDestination = buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: "/",
    currentHost: host,
    currentProtocol: protocol,
  });

  try {
    const token = await getSessionToken();

    if (token) {
      // Delete session from database
      await deleteSession(token);
    }

    // Redirect through the canonical surface helper; localhost remains only a legacy fallback.
    const redirectUrl = new URL(redirectDestination, request.url);
    
    // Create redirect response
    const response = NextResponse.redirect(redirectUrl, 303);
    
    // Delete session cookie on response
    await deleteSessionCookieAction();
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    // Even on error, redirect to homepage
    const redirectUrl = new URL(redirectDestination, request.url);
    const response = NextResponse.redirect(redirectUrl, 303);
    await deleteSessionCookieAction();
    return response;
  }
}
