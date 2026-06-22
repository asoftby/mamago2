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

  const isBusinessHost = isHost(host, ["business.mamago.local", "business.mamago.by"]);
  const isAdminHost = isHost(host, ["admin.mamago.local", "admin.mamago.by"]);
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
