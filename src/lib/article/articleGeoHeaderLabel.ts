import type { GeoScope } from "@prisma/client";

/**
 * Single source of truth for the geo label shown in the public header on an
 * article detail page. CITY reflects the actual article city; REGION the
 * actual article region; COUNTRY (and any unset/legacy geoScope) falls back
 * to "Беларусь" — never to a hardcoded city.
 */
export function resolveArticleGeoHeaderLabel(args: {
  geoScope: GeoScope | null;
  cityName: string | null;
  regionName: string | null;
}): string {
  if (args.geoScope === "CITY") return args.cityName ?? "Беларусь";
  if (args.geoScope === "REGION") return args.regionName ?? "Беларусь";
  return "Беларусь";
}
