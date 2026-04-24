import { getCityNominativeName, KNOWN_CITY_SLUGS } from "@/lib/city/cityDisplayNames";

export const DEFAULT_CITY_SLUG = "minsk" as const;

export const RESERVED_TOP_LEVEL_SEGMENTS = [
  "me",
  "admin",
  "business",
  "api",
  "_next",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "account",
  "preview",
  "blog",
  "places",
  "offers",
  "routes",
  "search",
  "ideas",
  "birthday",
  "ui-test",
] as const;

export type ResolvedCityContext = {
  citySlug: string | null;
  cityName: string | null;
  source: "route" | "preference" | "default" | "none";
  isCityRoute: boolean;
  isFallback: boolean;
};

type ResolveCityContextInput = {
  pathname: string | null;
  cityFromQuery?: string | null;
  preferredCitySlug?: string | null;
  allowedCitySlugs?: Iterable<string>;
  defaultCitySlug?: string | null;
};

function normalizeSlug(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function firstPathSegment(pathname: string | null): string | null {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  return normalizeSlug(segments[0]);
}

export function buildAllowedCitySlugSet(additionalSlugs?: Iterable<string>): Set<string> {
  const set = new Set<string>([DEFAULT_CITY_SLUG, ...KNOWN_CITY_SLUGS.map((slug) => slug.toLowerCase())]);
  if (!additionalSlugs) return set;
  for (const slug of additionalSlugs) {
    const normalized = normalizeSlug(slug);
    if (normalized) set.add(normalized);
  }
  return set;
}

export function isReservedTopLevelSegment(segment: string | null | undefined): boolean {
  const normalized = normalizeSlug(segment);
  if (!normalized) return true;
  return RESERVED_TOP_LEVEL_SEGMENTS.includes(
    normalized as (typeof RESERVED_TOP_LEVEL_SEGMENTS)[number],
  );
}

export function resolveRouteCitySlug(
  pathname: string | null,
  allowedCitySlugs?: Iterable<string>,
): string | null {
  const firstSegment = firstPathSegment(pathname);
  if (!firstSegment || isReservedTopLevelSegment(firstSegment)) return null;
  const allowed = buildAllowedCitySlugSet(allowedCitySlugs);
  return allowed.has(firstSegment) ? firstSegment : null;
}

function resolveValidCitySlug(
  candidate: string | null | undefined,
  allowedCitySlugs: Set<string>,
): string | null {
  const normalized = normalizeSlug(candidate);
  if (!normalized) return null;
  return allowedCitySlugs.has(normalized) ? normalized : null;
}

export function resolveCityContext(input: ResolveCityContextInput): ResolvedCityContext {
  const allowedCitySlugs = buildAllowedCitySlugSet(input.allowedCitySlugs);

  const routeCitySlug = resolveRouteCitySlug(input.pathname, allowedCitySlugs);
  if (routeCitySlug) {
    return {
      citySlug: routeCitySlug,
      cityName: getCityNominativeName(routeCitySlug),
      source: "route",
      isCityRoute: true,
      isFallback: false,
    };
  }

  const preferredCitySlug =
    resolveValidCitySlug(input.cityFromQuery, allowedCitySlugs) ??
    resolveValidCitySlug(input.preferredCitySlug, allowedCitySlugs);
  if (preferredCitySlug) {
    return {
      citySlug: preferredCitySlug,
      cityName: getCityNominativeName(preferredCitySlug),
      source: "preference",
      isCityRoute: false,
      isFallback: true,
    };
  }

  const defaultCitySlug = resolveValidCitySlug(
    input.defaultCitySlug ?? DEFAULT_CITY_SLUG,
    allowedCitySlugs,
  );
  if (defaultCitySlug) {
    return {
      citySlug: defaultCitySlug,
      cityName: getCityNominativeName(defaultCitySlug),
      source: "default",
      isCityRoute: false,
      isFallback: true,
    };
  }

  return {
    citySlug: null,
    cityName: null,
    source: "none",
    isCityRoute: false,
    isFallback: true,
  };
}
