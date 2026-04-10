import { NextRequest, NextResponse } from "next/server";
import {
  getSessionToken,
  deleteSession,
  deleteSessionCookie,
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

    // Always redirect to / on same domain (no subdomain logic for localhost)
    const redirectUrl = new URL(redirectDestination, request.url);
    
    // Create redirect response
    const response = NextResponse.redirect(redirectUrl, 303);
    
    // Delete session cookie on response
    deleteSessionCookie(response);
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    // Even on error, redirect to homepage
    const redirectUrl = new URL(redirectDestination, request.url);
    const response = NextResponse.redirect(redirectUrl, 303);
    deleteSessionCookie(response);
    return response;
  }
}
