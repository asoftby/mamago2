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

  // 1) Business host -> rewrite to /business/*
  const isBusinessHost = isHost(host, ["business.localhost", "business.mamago.by"]);
  if (isBusinessHost) {
    if (!url.pathname.startsWith("/business")) {
      url.pathname = `/business${url.pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 2) Admin host -> rewrite to /admin/*
  const isAdminHost = isHost(host, ["admin.localhost", "admin.mamago.by"]);
  if (isAdminHost) {
    if (!url.pathname.startsWith("/admin")) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 3) Public host -> redirect / -> /minsk
  if (url.pathname === "/") {
    url.pathname = "/minsk";
    // 307 preserves method; good default for "temporary but stable" redirect in dev.
    // Later in prod you can switch to 308 if you want "permanent".
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};