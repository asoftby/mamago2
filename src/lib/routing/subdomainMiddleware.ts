import { stripPublicDiscoverySearchParams } from "@/lib/routing/publicDiscoverySearchParams";

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
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (isLocalhost) {
    // Legacy development fallback. Canonical local dev uses mamago.local subdomains.
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

  const isBusinessHost = isHost(host, ["business.mamago.local", "business.mamago.by"]);
  const isAdminHost = isHost(host, ["admin.mamago.local", "admin.mamago.by"]);
  const adminSafeSearch = isAdminHost ? stripPublicDiscoverySearchParams(search) : search;

  if (isBusinessHost || isAdminHost) {
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
