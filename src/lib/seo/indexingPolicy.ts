import type { Metadata } from "next";

/**
 * Permanent robots policy for non-public or unfinished surfaces.
 * Unlike the release-wide noindex gate, this must remain active after
 * SITE_INDEXING_ENABLED=true.
 */
export const PERMANENT_NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
};

const PERMANENT_NOINDEX_PREFIXES = [
  "/account",
  "/activate",
  "/auth",
  "/business-entry",
  "/editor",
  "/forgot-password",
  "/identity",
  "/invite",
  "/login",
  "/me",
  "/preview",
  "/register",
  "/reset-password",
  "/settings",
  "/u",
  "/ui-lab",
  "/__filters-demo",
] as const;

const ROUTE_EDITOR_PATTERN = /^\/routes\/(?:new|[^/]+\/edit)(?:\/|$)/u;
const BIRTHDAY_BUILDER_PATTERN = /^\/[^/]+\/birthday\/make(?:\/|$)/u;

export function isPermanentlyNoindexPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname;

  if (
    PERMANENT_NOINDEX_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  return ROUTE_EDITOR_PATTERN.test(normalized) || BIRTHDAY_BUILDER_PATTERN.test(normalized);
}

export function isPermanentlyNoindexSurface(surface: string): boolean {
  return surface === "admin" || surface === "business";
}
