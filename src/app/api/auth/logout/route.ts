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

    // Delete session cookie
    await deleteSessionCookie();

    // Redirect to public homepage
    // If on business subdomain, redirect to public domain
    // Otherwise redirect to / (which will redirect to /minsk via middleware)
    const host = request.headers.get("host") || "";
    const isBusinessHost = host.startsWith("business.localhost") || host.startsWith("business.mamago.by");
    
    let redirectUrl: URL;
    if (isBusinessHost) {
      // Redirect to public domain
      const publicBase = process.env.NEXT_PUBLIC_APP_URL || 
        (host.startsWith("business.localhost") 
          ? `http://localhost:3000`
          : "https://mamago.by");
      redirectUrl = new URL("/", publicBase);
    } else {
      // Redirect to / on same domain
      redirectUrl = new URL("/", request.url);
    }
    
    // Use 303 See Other for POST->GET redirect (standard for form submissions)
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    console.error("Logout error:", error);
    // Even on error, redirect to homepage (user likely wants to leave anyway)
    const redirectUrl = new URL("/", request.url);
    return NextResponse.redirect(redirectUrl, 303);
  }
}
