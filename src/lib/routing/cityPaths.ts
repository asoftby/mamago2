/**
 * City-scoped public URL contract.
 *
 * Single source of truth for:
 * - Which domain serves which country  (getBaseUrl / getCountryFromHost)
 * - How public paths are built          (buildCityPublicPath)
 *
 * Adding a new country later = edit getBaseUrl + getCountryFromHost only.
 * Adding a new city = config in the database; no code change.
 */

import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

export type CountryCode = "BY";

export type CityPathType =
  | "hub"        // /[city]
  | "events"     // /[city]/events
  | "places"     // /[city]/places
  | "place"      // /[city]/places/[slug]
  | "offerList"  // /[city]/offers/[section]
  | "offer"      // /[city]/offers/[section]/[slug]
  | "routes"     // /[city]/routes
  | "route"      // /[city]/routes/[slug]
  | "journal"    // /[city]/blog  (alias kept for back-compat)
  | "article";   // /[city]/blog/[slug]

/**
 * Returns the canonical base URL for a country.
 * Today only "BY" is supported and maps to the configured app URL.
 * When adding e.g. PL → add a branch here; nowhere else.
 */
export function getBaseUrl(countryCode: CountryCode = "BY"): string {
  // Reserved for future: if (countryCode === "PL") return "https://mamago.pl";
  void countryCode;
  return getCanonicalPublicAppUrl().replace(/\/+$/, "");
}

/**
 * Derives country from request host.
 * Today always returns "BY" — this is the seam for future host-based routing.
 * A host-middleware will call this when we add a second country domain.
 */
export function getCountryFromHost(_host: string): CountryCode {
  return "BY";
}

/**
 * Strips trailing slash from a public path.
 * Root `/` is the only exception — it stays as `/`.
 *
 * This is the canonical normaliser for the no-trailing-slash URL policy.
 *
 * @example
 * stripTrailingSlash("/")             → "/"
 * stripTrailingSlash("/minsk/")       → "/minsk"
 * stripTrailingSlash("/minsk/events") → "/minsk/events"
 */
export function stripTrailingSlash(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * @deprecated Renamed to stripTrailingSlash — no-trailing-slash policy.
 * Kept for one-step migration; remove callers and delete this alias.
 */
export const withTrailingSlash = stripTrailingSlash;

export interface CityPublicPathParams {
  citySlug: string;
  type: CityPathType;
  section?: string;
  slug?: string;
}

/**
 * Builds a canonical public path for a city-scoped resource.
 * All public link construction MUST go through this function.
 */
export function buildCityPublicPath(params: CityPublicPathParams): string {
  const { citySlug, type, section, slug } = params;
  const city = citySlug.toLowerCase();

  let path: string;
  switch (type) {
    case "hub":
      path = `/${city}`;
      break;
    case "events":
      path = `/${city}/events`;
      break;
    case "places":
      path = `/${city}/places`;
      break;
    case "place":
      path = `/${city}/places/${slug}`;
      break;
    case "offerList":
      path = `/${city}/offers/${section}`;
      break;
    case "offer":
      path = `/${city}/offers/${section}/${slug}`;
      break;
    case "routes":
      path = `/${city}/routes`;
      break;
    case "route":
      path = `/${city}/routes/${slug}`;
      break;
    case "journal":
      path = `/${city}/blog`;
      break;
    case "article":
      path = `/${city}/blog/${slug}`;
      break;
  }

  return path;
}

/**
 * Builds an absolute canonical URL for a city-scoped resource.
 */
export function buildCityPublicUrl(
  params: CityPublicPathParams,
  countryCode: CountryCode = "BY",
): string {
  return `${getBaseUrl(countryCode)}${buildCityPublicPath(params)}`;
}

/**
 * Builds the canonical path for a COUNTRY-scope (national) article.
 * National articles live at /blog/{slug}.
 */
export function buildNationalArticlePath(slug: string): string {
  return `/blog/${slug}`;
}

/**
 * Article public path by geo scope (no trailing slash).
 * CITY → /{city}/blog/{slug} ; COUNTRY (and breaking news) → /blog/{slug}.
 */
export function buildArticlePublicPath(args: {
  slug: string;
  geoScope?: "CITY" | "COUNTRY" | null;
  citySlug?: string | null;
}): string {
  const { slug, geoScope, citySlug } = args;
  if (geoScope === "CITY" && citySlug) {
    return buildCityPublicPath({ citySlug, type: "article", slug });
  }
  return buildNationalArticlePath(slug);
}

/** Absolute canonical public URL (no trailing slash). */
export function buildAbsoluteCanonicalUrl(
  path: string,
  countryCode: CountryCode = "BY",
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl(countryCode)}${stripTrailingSlash(normalized)}`;
}

/**
 * Builds the absolute canonical URL for a COUNTRY-scope (national) article.
 */
export function buildNationalArticleUrl(slug: string, countryCode: CountryCode = "BY"): string {
  return `${getBaseUrl(countryCode)}${buildNationalArticlePath(slug)}`;
}
