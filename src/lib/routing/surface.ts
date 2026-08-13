/**
 * App surface routing.
 *
 * Host-based routing is the canonical architecture for production and local
 * development (`mamago.local`, `business.mamago.local`, `admin.mamago.local`).
 * Path prefixes remain in place as compatibility fallbacks and internal routes.
 */

import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { stripPublicDiscoverySearchParamsFromPath } from "@/lib/routing/publicDiscoverySearchParams";

export type AppSurface = "public" | "admin" | "business";

/** Canonical path prefix for the admin UI (App Router). */
export const ADMIN_PATH_PREFIX = "/admin";

/** Canonical path prefix for the business UI (App Router). */
export const BUSINESS_PATH_PREFIX = "/business";

const SUPPORTED_SURFACE_BASE_HOSTS = [
  "dev.mamago.by",
  "prod.mamago.by",
  "mamago.by",
  "mamago.local",
] as const;

/**
 * Builds an absolute admin destination path under {@link ADMIN_PATH_PREFIX}.
 * Empty string yields `/admin/` (same behavior as the historical `adminPath` helper).
 */
export function buildAdminPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_PATH_PREFIX}${cleanPath}`;
}

/** Historical name — use {@link buildAdminPath}; kept for drop-in compatibility. */
export const adminPath = buildAdminPath;

/**
 * Builds an absolute business destination path under {@link BUSINESS_PATH_PREFIX}.
 */
export function buildBusinessPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BUSINESS_PATH_PREFIX}${cleanPath}`;
}

/**
 * Normalizes a public (non-admin, non-business app shell) path.
 */
export function buildPublicPath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function splitPathQueryAndHash(path: string): {
  pathname: string;
  search: string;
  hash: string;
} {
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/u.exec(path);

  return {
    pathname: match?.[1] || "/",
    search: match?.[2] || "",
    hash: match?.[3] || "",
  };
}

function stripSurfacePrefix(pathname: string, surface: AppSurface): string {
  if (surface === "admin") {
    if (pathname === ADMIN_PATH_PREFIX) return "/";
    if (pathname.startsWith(`${ADMIN_PATH_PREFIX}/`)) {
      return pathname.slice(ADMIN_PATH_PREFIX.length) || "/";
    }
  }

  if (surface === "business") {
    if (pathname === BUSINESS_PATH_PREFIX) return "/";
    if (pathname.startsWith(`${BUSINESS_PATH_PREFIX}/`)) {
      return pathname.slice(BUSINESS_PATH_PREFIX.length) || "/";
    }
  }

  return pathname;
}

function buildExternalPathForSurface(surface: AppSurface, path: string): string {
  const { pathname, search, hash } = splitPathQueryAndHash(path);
  const visiblePathname = stripSurfacePrefix(pathname, surface);
  return `${visiblePathname}${search}${hash}`;
}

export function normalizeTargetPathForSurface(surface: AppSurface, path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }

  const { pathname, search, hash } = splitPathQueryAndHash(path);
  const normalizedPathname = stripSurfacePrefix(pathname, surface);
  const normalizedPath = `${normalizedPathname}${search}${hash}`;
  return surface === "admin"
    ? stripPublicDiscoverySearchParamsFromPath(normalizedPath)
    : normalizedPath;
}

function parseHost(host: string): { hostname: string; port: string } {
  const normalized = host.trim().replace(/^\[|\]$/g, "");
  const lastColon = normalized.lastIndexOf(":");

  if (lastColon === -1) {
    return { hostname: normalized.toLowerCase(), port: "" };
  }

  const hostname = normalized.slice(0, lastColon).toLowerCase();
  const port = normalized.slice(lastColon + 1);

  if (/^\d+$/u.test(port) && hostname.length > 0) {
    return { hostname, port };
  }

  return { hostname: normalized.toLowerCase(), port: "" };
}

/**
 * Dev-only local-network host detection for LAN testing.
 * Accepts hostname without port (e.g. "192.168.1.10").
 * 
 * NOTE: Does NOT treat *.mamago.local or *.mamago.by as "dev local" 
 * because those are our supported base hosts that need proper subdomain routing.
 */
export function isDevLocalHost(hostname: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (!hostname) return false;

  // Check if this is one of our supported base hosts or their subdomains
  for (const baseHost of SUPPORTED_SURFACE_BASE_HOSTS) {
    if (
      hostname === baseHost ||
      hostname === `admin.${baseHost}` ||
      hostname === `business.${baseHost}`
    ) {
      return false; // These need proper host-based routing
    }
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.startsWith("192.168.") || hostname.startsWith("10.")) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\./u.test(hostname);
}

function resolveSupportedBaseHost(host: string | undefined): {
  baseHost: (typeof SUPPORTED_SURFACE_BASE_HOSTS)[number];
  port: string;
} | null {
  if (!host) return null;

  const { hostname, port } = parseHost(host);
  if (!hostname || isDevLocalHost(hostname)) {
    return null;
  }

  for (const baseHost of SUPPORTED_SURFACE_BASE_HOSTS) {
    if (
      hostname === baseHost ||
      hostname === `admin.${baseHost}` ||
      hostname === `business.${baseHost}`
    ) {
      return { baseHost, port };
    }
  }

  return null;
}

function getSurfaceHost(surface: AppSurface, baseHost: string): string {
  if (surface === "admin") return `admin.${baseHost}`;
  if (surface === "business") return `business.${baseHost}`;
  return baseHost;
}

function inferProtocol(host: string | undefined, explicitProtocol: string | undefined): string {
  if (explicitProtocol === "http" || explicitProtocol === "https") {
    return explicitProtocol;
  }

  if (!host) return "https";

  const { hostname } = parseHost(host);
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  ) {
    return "http";
  }

  return "https";
}

export function buildSurfaceRedirectDestination(params: {
  targetSurface: AppSurface;
  targetPath: string;
  currentHost?: string | null;
  currentProtocol?: string | null;
}): string {
  const internalPath =
    params.targetSurface === "admin"
      ? buildAdminPath(params.targetPath)
      : params.targetSurface === "business"
        ? buildBusinessPath(params.targetPath)
        : buildPublicPath(params.targetPath);
  const normalizedInternalPath =
    params.targetSurface === "admin"
      ? stripPublicDiscoverySearchParamsFromPath(internalPath)
      : internalPath;

  const resolvedHost = resolveSupportedBaseHost(params.currentHost ?? undefined);
  if (!resolvedHost) {
    return normalizedInternalPath;
  }

  const protocol = inferProtocol(
    params.currentHost ?? undefined,
    params.currentProtocol ?? undefined,
  );
  const targetHost = getSurfaceHost(params.targetSurface, resolvedHost.baseHost);
  const hostWithPort = resolvedHost.port ? `${targetHost}:${resolvedHost.port}` : targetHost;
  const visiblePath = buildExternalPathForSurface(params.targetSurface, normalizedInternalPath);

  return `${protocol}://${hostWithPort}${visiblePath}`;
}

/** Витрина по умолчанию при переходе из admin/business на публичный сайт (город). */
/**
 * Default entry path from admin/business → public site.
 * Points to the Minsk city hub (standard city path, not a special case).
 * When adding a city selector or geo-detection, update this to "/" instead.
 */
export const PUBLIC_SITE_DEFAULT_ENTRY_PATH = "/minsk";

/**
 * Абсолютный URL публичной витрины (учитывает admin.* / business.* → основной хост).
 * Если хост не распознан как поддоменная схема mamago — добавляет {@link getCanonicalPublicAppUrl}.
 */
export function buildPublicSiteEntryUrl(params: {
  currentHost?: string | null;
  currentProtocol?: string | null;
}): string {
  const dest = buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: PUBLIC_SITE_DEFAULT_ENTRY_PATH,
    currentHost: params.currentHost ?? undefined,
    currentProtocol: params.currentProtocol ?? undefined,
  });
  if (dest.startsWith("http://") || dest.startsWith("https://")) {
    return dest;
  }
  const base = getCanonicalPublicAppUrl().replace(/\/+$/u, "");
  const path = dest.startsWith("/") ? dest : `/${dest}`;
  return `${base}${path}`;
}

/**
 * Detects surface from pathname using current path-prefix rules.
 */
export function surfaceFromPathname(pathname: string): AppSurface {
  if (
    pathname === ADMIN_PATH_PREFIX ||
    pathname.startsWith(`${ADMIN_PATH_PREFIX}/`)
  ) {
    return "admin";
  }
  if (
    pathname === BUSINESS_PATH_PREFIX ||
    pathname.startsWith(`${BUSINESS_PATH_PREFIX}/`)
  ) {
    return "business";
  }
  return "public";
}

/**
 * Resolves surface from host + pathname.
 * Pathname prefixes still override host to preserve compatibility during the migration.
 */
export function resolveSurfaceFromHostAndPathname(
  host: string | undefined,
  pathname: string,
): AppSurface {
  const pathSurface = surfaceFromPathname(pathname);
  if (pathSurface !== "public") {
    return pathSurface;
  }

  const resolvedHost = resolveSupportedBaseHost(host);
  if (!resolvedHost) {
    return "public";
  }

  const { hostname } = parseHost(host ?? "");
  if (hostname === `admin.${resolvedHost.baseHost}`) {
    return "admin";
  }
  if (hostname === `business.${resolvedHost.baseHost}`) {
    return "business";
  }

  return "public";
}
