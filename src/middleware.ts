import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl;

  const isAdminHost =
    host.startsWith("admin.localhost") ||
    host.startsWith("admin.mamago.by");

  // 1) Admin host -> rewrite to /admin/*
  if (isAdminHost) {
    if (!url.pathname.startsWith("/admin")) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 2) Public host -> redirect / -> /minsk
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