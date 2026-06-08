import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSubdomainMiddlewareDecision } from "@/lib/routing/subdomainMiddleware";
import { isDevLocalHost, resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";
import { stripPublicDiscoverySearchParams } from "@/lib/routing/publicDiscoverySearchParams";
import { isGlobalNoindexEnabled } from "@/lib/seo/globalNoindex";
import {
  REQUEST_PATHNAME_HEADER,
  REQUEST_SEARCH_HEADER,
} from "@/lib/auth/requireAuthRedirect";

let didLogDevLocalHostDetection = false;

function shouldBypassSeoHeader(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  );
}

function withRequestPathHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_PATHNAME_HEADER, request.nextUrl.pathname);
  requestHeaders.set(REQUEST_SEARCH_HEADER, request.nextUrl.search);
  return requestHeaders;
}

function nextWithRequestPath(request: NextRequest): NextResponse {
  return NextResponse.next({
    request: { headers: withRequestPathHeaders(request) },
  });
}

function rewriteWithRequestPath(request: NextRequest, url: URL): NextResponse {
  return NextResponse.rewrite(url, {
    request: { headers: withRequestPathHeaders(request) },
  });
}

function applyGlobalNoindexHeader(
  response: NextResponse,
  params: {
    pathname: string;
    surface: "public" | "admin" | "business";
  },
): NextResponse {
  if (
    !isGlobalNoindexEnabled() ||
    params.surface !== "public" ||
    shouldBypassSeoHeader(params.pathname)
  ) {
    return response;
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl;
  const pathname = url.pathname;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  if (shouldBypassSeoHeader(pathname)) {
    return nextWithRequestPath(request);
  }

  if (
    !didLogDevLocalHostDetection &&
    isDevLocalHost(hostname) &&
    process.env.NODE_ENV === "development"
  ) {
    didLogDevLocalHostDetection = true;
    console.info("[dev-host] Local network host detected, using public surface");
  }

  const surface = resolveSurfaceFromHostAndPathname(host, pathname);
  const search =
    surface === "admin" ? stripPublicDiscoverySearchParams(url.search) : url.search;

  const decision = resolveSubdomainMiddlewareDecision({
    host,
    protocol: url.protocol,
    pathname,
    search,
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (process.env.NODE_ENV === "development") {
    console.info(`[middleware] ${host}${pathname} -> ${decision.kind}`, decision);
  }

  if (decision.kind === "redirect") {
    return NextResponse.redirect(decision.location);
  }

  if (decision.kind === "rewrite") {
    url.pathname = decision.pathname;
    url.search = search;
    return applyGlobalNoindexHeader(rewriteWithRequestPath(request, url), {
        pathname,
        surface,
    });
  }

  if (surface === "admin" && search !== url.search) {
    url.search = search;
    return NextResponse.redirect(url);
  }

  return applyGlobalNoindexHeader(nextWithRequestPath(request), {
    pathname,
    surface,
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\..*).*)",
  ],
};
