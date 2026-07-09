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
import {
  shouldSkipTrailingSlashRedirect,
  removeTrailingSlash,
} from "@/lib/routing/trailingSlashPolicy";
import {
  isWpLegacyCatchAllPath,
  WP_LEGACY_CATCH_ALL_DESTINATION,
} from "@/lib/routing/wpLegacyCatchAll";

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
  },
): NextResponse {
  if (!isGlobalNoindexEnabled() || shouldBypassSeoHeader(params.pathname)) {
    return response;
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}


export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Absolute hard exit for API routes and Next.js internals ─────────────
  // Must come FIRST — before any redirect, rewrite, or header logic.
  // The config.matcher already excludes /api/* via the negative lookahead, but
  // this guard is a second line of defence (e.g. internal server-side fetches
  // or rewrite chains that bypass the matcher).
  if (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") || "";
  const url = request.nextUrl;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  // ── Trailing-slash canonical redirect (301) ──────────────────────────────
  // Runs before subdomain/surface logic so SEO crawlers always land on the
  // no-slash canonical. Fires only on GET/HEAD to avoid breaking form POSTs.
  if (
    pathname.endsWith("/") &&
    !shouldSkipTrailingSlashRedirect(pathname) &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = removeTrailingSlash(pathname);
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  // ── WP-migration catch-all (301 → hub) ──────────────────────────────────
  // Config redirects (manifest.csv) уже отработали до middleware; сюда доходит
  // только непокрытый хвост WordPress. Известные секции/города/reserved и
  // asset-подобные пути проходят дальше и 404-ятся как обычно.
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    resolveSurfaceFromHostAndPathname(host, pathname) === "public" &&
    isWpLegacyCatchAllPath(pathname)
  ) {
    return NextResponse.redirect(
      new URL(WP_LEGACY_CATCH_ALL_DESTINATION, request.url),
      { status: 301 },
    );
  }

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
    });
  }

  if (surface === "admin" && search !== url.search) {
    url.search = search;
    return NextResponse.redirect(url);
  }

  return applyGlobalNoindexHeader(nextWithRequestPath(request), {
    pathname,
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\..*).*)",
  ],
};
