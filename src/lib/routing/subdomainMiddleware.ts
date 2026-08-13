import { stripPublicDiscoverySearchParams } from "@/lib/routing/publicDiscoverySearchParams";
import { isDevLocalHost } from "@/lib/routing/surface";

export type MiddlewareDecision =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; location: string };

function isHost(host: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => host.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  );
}

function isEditorRoute(pathname: string): boolean {
  return pathname === "/editor" || pathname.startsWith("/editor/");
}

/**
 * Route (маршрут) view/create/edit pages live in the public route group but
 * are also opened from the admin content list (shared RouteEditor wizard).
 * Like `isEditorRoute`, they must stay on the current subdomain surface:
 * the admin-host fallback rewrite would turn `/routes/{slug}/edit` into a
 * nonexistent `/admin/routes/...` page (404), and a cross-origin redirect
 * would break App Router RSC navigation from admin.
 */
function isRouteContentRoute(pathname: string): boolean {
  return pathname === "/routes" || pathname.startsWith("/routes/");
}

/**
 * `/me/{places|offers|events}/{id}/preview` — opened from the admin content
 * list (relative link) as well as from the business cabinet. Like
 * `isEditorRoute`/`isRouteContentRoute`, these must stay on the current
 * subdomain surface: the admin/business fallback rewrite would turn this
 * into a nonexistent `/admin/me/...` or `/business/me/...` page (404).
 * Deliberately an exact-format allowlist, not a blanket `/me/*` bypass —
 * every other `/me/...` route keeps going through the normal rewrite.
 */
const CONTENT_PREVIEW_ROUTE_PATTERN = /^\/me\/(places|offers|events)\/[^/]+\/preview$/;

function isContentPreviewRoute(pathname: string): boolean {
  return CONTENT_PREVIEW_ROUTE_PATTERN.test(pathname);
}

const ARTICLE_PREVIEW_ROUTE_PATTERN = /^\/preview\/articles\/[^/]+$/;

function isArticlePreviewRoute(pathname: string): boolean {
  return ARTICLE_PREVIEW_ROUTE_PATTERN.test(pathname);
}

function isPublicInviteRoute(pathname: string): boolean {
  return pathname === "/invite/business";
}

function stripSubdomainPrefix(host: string): string {
  if (host.startsWith("business.")) {
    return host.replace(/^business\./u, "");
  }
  if (host.startsWith("admin.")) {
    return host.replace(/^admin\./u, "");
  }
  return host;
}

export function getPublicBaseFromHost(host: string, protocol: string): string {
  return `${protocol}//${stripSubdomainPrefix(host)}`;
}

function buildPublicLocation(params: {
  host: string;
  protocol: string;
  pathname: string;
  search: string;
  publicAppUrl?: string;
}): string {
  const publicBase = params.publicAppUrl || getPublicBaseFromHost(params.host, params.protocol);
  return new URL(`${params.pathname}${params.search}`, publicBase).toString();
}

function buildSameHostLocation(params: {
  protocol: string;
  host: string;
  pathname: string;
  search: string;
}): string {
  return `${params.protocol}//${params.host}${params.pathname}${params.search}`;
}

export function resolveSubdomainMiddlewareDecision(params: {
  host: string;
  protocol: string;
  pathname: string;
  search: string;
  publicAppUrl?: string;
}): MiddlewareDecision {
  const { host, protocol, pathname, search, publicAppUrl } = params;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  // API routes must never be rewritten or redirected by subdomain logic.
  // This is a second line of defence after the middleware.ts hard exit and the
  // config.matcher exclusion.
  if (pathname.startsWith("/api/") || pathname === "/api") {
    return { kind: "next" };
  }

  const isLocalhost = isDevLocalHost(hostname);

  if (isLocalhost) {
    // Dev LAN / localhost fallback: keep path as-is and treat as public surface.
    return { kind: "next" };
  }

  const isBusinessHost = isHost(host, [
    "business.mamago.local",
    "business.mamago.by",
    "business.dev.mamago.by",
    "business.prod.mamago.by",
  ]);
  const isAdminHost = isHost(host, [
    "admin.mamago.local",
    "admin.mamago.by",
    "admin.dev.mamago.by",
    "admin.prod.mamago.by",
  ]);
  const adminSafeSearch = isAdminHost ? stripPublicDiscoverySearchParams(search) : search;

  if (isBusinessHost || isAdminHost) {
    if (isAdminHost && (pathname === "/dashboard" || pathname === "/admin/dashboard")) {
      return {
        kind: "redirect",
        location: buildSameHostLocation({
          protocol,
          host,
          pathname: "/",
          search: adminSafeSearch,
        }),
      };
    }

    if (isPublicInviteRoute(pathname)) {
      return {
        kind: "redirect",
        location: buildPublicLocation({
          host,
          protocol,
          pathname,
          search: adminSafeSearch,
          publicAppUrl,
        }),
      };
    }

    if (pathname === "/business" || pathname.startsWith("/business/")) {
      const strippedPathname = pathname.slice("/business".length) || "/";
      return {
        kind: "redirect",
        location: buildSameHostLocation({
          protocol,
          host,
          pathname: strippedPathname,
          search: adminSafeSearch,
        }),
      };
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const strippedPathname = pathname.slice("/admin".length) || "/";
      return {
        kind: "redirect",
        location: buildSameHostLocation({
          protocol,
          host,
          pathname: strippedPathname,
          search: adminSafeSearch,
        }),
      };
    }

    if (isEditorRoute(pathname)) {
      // Keep the isolated content editor on the current subdomain surface.
      // A cross-origin redirect here breaks App Router RSC navigation from admin.
      return { kind: "next" };
    }

    if (isRouteContentRoute(pathname)) {
      // Route view/create/edit (shared RouteEditor wizard) — same reasoning
      // as isEditorRoute: serve the public route-group page on this surface
      // instead of rewriting into a nonexistent /admin/routes/* or
      // /business/routes/* page.
      return { kind: "next" };
    }

    if (isContentPreviewRoute(pathname)) {
      return { kind: "next" };
    }

    if (isAdminHost && isArticlePreviewRoute(pathname)) {
      return { kind: "next" };
    }
  }

  if (isBusinessHost) {
    if (isAuthRoute(pathname)) {
      return {
        kind: "redirect",
        location: buildPublicLocation({
          host,
          protocol,
          pathname,
          search: adminSafeSearch,
          publicAppUrl,
        }),
      };
    }

    return {
      kind: "rewrite",
      pathname: pathname.startsWith("/business") ? pathname : `/business${pathname}`,
    };
  }

  if (isAdminHost) {
    if (isAuthRoute(pathname)) {
      return {
        kind: "redirect",
        location: buildPublicLocation({
          host,
          protocol,
          pathname,
          search: adminSafeSearch,
          publicAppUrl,
        }),
      };
    }

    return {
      kind: "rewrite",
      pathname: pathname.startsWith("/admin") ? pathname : `/admin${pathname}`,
    };
  }

  if (pathname === "/") {
    return {
      kind: "redirect",
      location: buildSameHostLocation({
        protocol,
        host,
        pathname: "/minsk",
        search: "",
      }),
    };
  }

  return { kind: "next" };
}
