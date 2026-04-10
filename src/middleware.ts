import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSubdomainMiddlewareDecision } from "@/lib/routing/subdomainMiddleware";

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

  const decision = resolveSubdomainMiddlewareDecision({
    host,
    protocol: url.protocol,
    pathname,
    search,
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (decision.kind === "redirect") {
    return NextResponse.redirect(decision.location);
  }

  if (decision.kind === "rewrite") {
    url.pathname = decision.pathname;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)"],
};
