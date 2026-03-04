import { NextRequest, NextResponse } from "next/server";
import {
  getSessionToken,
  deleteSession,
  deleteSessionCookie,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const token = await getSessionToken();

    if (token) {
      // Delete session from database
      await deleteSession(token);
    }

    // Always redirect to / on same domain (no subdomain logic for localhost)
    const redirectUrl = new URL("/", request.url);
    
    // Create redirect response
    const response = NextResponse.redirect(redirectUrl, 303);
    
    // Delete session cookie on response
    deleteSessionCookie(response);
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    // Even on error, redirect to homepage
    const redirectUrl = new URL("/", request.url);
    const response = NextResponse.redirect(redirectUrl, 303);
    deleteSessionCookie(response);
    return response;
  }
}
