import { NextRequest, NextResponse } from "next/server";
import {
  getSessionToken,
  deleteSession,
  deleteSessionCookie,
} from "@/lib/auth/session";
import { readRedirectParam, getSafeRedirectPath } from "@/lib/auth/redirectTo";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import {
  normalizeTargetPathForSurface,
  surfaceFromPathname,
} from "@/lib/routing/surface";

export async function POST(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(/:$/u, "");
  const redirectParam =
    readRedirectParam(request.nextUrl.searchParams) ??
    request.nextUrl.searchParams.get("next") ??
    undefined;
  const safeRedirect = getSafeRedirectPath(redirectParam, "/");
  const targetPath =
    safeRedirect !== "/"
      ? normalizeTargetPathForSurface(surfaceFromPathname(safeRedirect), safeRedirect)
      : "/";
  const targetSurface =
    safeRedirect !== "/" ? surfaceFromPathname(safeRedirect) : "public";

  const redirectDestination = buildSurfaceRedirectDestination({
    targetSurface,
    targetPath,
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
    redirectUrl.searchParams.set("loggedOut", "1");

    // Create redirect response
    const response = NextResponse.redirect(redirectUrl, 303);
    
    // Delete session cookie on response
    const requestHost = request.headers.get("host") ?? undefined;
    deleteSessionCookie(response, requestHost);
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    // Even on error, redirect to homepage
    const redirectUrl = new URL(redirectDestination, request.url);
    redirectUrl.searchParams.set("loggedOut", "1");
    const response = NextResponse.redirect(redirectUrl, 303);
    const requestHost = request.headers.get("host") ?? undefined;
    deleteSessionCookie(response, requestHost);
    return response;
  }
}
