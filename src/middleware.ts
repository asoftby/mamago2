import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Helper to check if host matches any of the given prefixes
 */
function isHost(host: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => host.startsWith(prefix));
}

/**
 * Derive public base URL from subdomain host
 * Strips subdomain prefix and preserves port in development
 * 
 * Examples:
 * - business.mamago.local:3002 -> http://mamago.local:3002
 * - business.localhost:3002 -> http://localhost:3002
 * - business.mamago.by -> https://mamago.by (no port in prod)
 * - admin.mamago.local:3002 -> http://mamago.local:3002
 */
function getPublicBaseFromHost(host: string, url: URL): string {
  // Strip subdomain prefix (business. or admin.)
  let strippedHost = host;
  if (host.startsWith("business.")) {
    strippedHost = host.replace(/^business\./, "");
  } else if (host.startsWith("admin.")) {
    strippedHost = host.replace(/^admin\./, "");
  }

  // Use protocol from request URL
  const protocol = url.protocol;
  
  return `${protocol}//${strippedHost}`;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl;
  const pathname = url.pathname;
  const search = url.search;

  // Early return for Next.js static assets and system files
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Check if localhost/127.0.0.1 (no subdomain logic in dev)
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (isLocalhost) {
    // Localhost: only redirect / -> /minsk, no subdomain rewrites
    if (pathname === "/") {
      url.pathname = "/minsk";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // For non-localhost (mamago.local / mamago.by): apply subdomain logic
  
  // Redirect auth routes from business subdomain to public domain
  const isBusinessHost = isHost(host, [
    "business.mamago.local",
    "business.mamago.by"
  ]);
  
  if (isBusinessHost) {
    const isAuthRoute =
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname.startsWith("/reset-password");

    if (isAuthRoute) {
      // Prefer env, fallback to derived public base
      const publicBase = process.env.NEXT_PUBLIC_APP_URL || getPublicBaseFromHost(host, url);
      const publicUrl = new URL(`${publicBase}${pathname}${search}`);
      return NextResponse.redirect(publicUrl);
    }
  }

  // 1) Business host -> rewrite to /business/*
  if (isBusinessHost) {
    if (!pathname.startsWith("/business")) {
      url.pathname = `/business${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 2) Admin host -> rewrite to /admin/*
  const isAdminHost = isHost(host, [
    "admin.mamago.local",
    "admin.mamago.by"
  ]);
  
  if (isAdminHost) {
    if (!pathname.startsWith("/admin")) {
      url.pathname = `/admin${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 3) Public host -> redirect / -> /minsk
  if (pathname === "/") {
    url.pathname = "/minsk";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)"],
};