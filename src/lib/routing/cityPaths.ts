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
  | "journal"    // /[city]/journal
  | "article";   // /[city]/journal/[slug]

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

  switch (type) {
    case "hub":
      return `/${city}`;
    case "events":
      return `/${city}/events`;
    case "places":
      return `/${city}/places`;
    case "place":
      return `/${city}/places/${slug}`;
    case "offerList":
      return `/${city}/offers/${section}`;
    case "offer":
      return `/${city}/offers/${section}/${slug}`;
    case "routes":
      return `/${city}/routes`;
    case "route":
      return `/${city}/routes/${slug}`;
    case "journal":
      return `/${city}/journal`;
    case "article":
      return `/${city}/journal/${slug}`;
  }
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
