import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Helper to check if host matches any of the given prefixes
 */
function isHost(host: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => host.startsWith(prefix));
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

  // Redirect auth routes from business subdomain to public domain
  const isBusinessHost = isHost(host, ["business.localhost", "business.mamago.by"]);
  if (isBusinessHost) {
    const isAuthRoute =
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname.startsWith("/reset-password");

    if (isAuthRoute) {
      // Prefer env, fallback to derived origin
      let publicBase = process.env.NEXT_PUBLIC_APP_URL;
      if (!publicBase) {
        if (host.startsWith("business.localhost")) {
          publicBase = "http://localhost:3000";
        } else if (host.startsWith("business.mamago.by")) {
          publicBase = "https://mamago.by";
        }
      }
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
  const isAdminHost = isHost(host, ["admin.localhost", "admin.mamago.by"]);
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
    // 307 preserves method; good default for "temporary but stable" redirect in dev.
    // Later in prod you can switch to 308 if you want "permanent".
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)"],
};