import { DEFAULT_TZ } from "@/server/geo/geoConstants";

/**
 * IANA timezone for calendar math in a city.
 * MVP: all product cities are Belarus → {@link DEFAULT_TZ}.
 * When `City` gains a timezone column, resolve it here.
 */
export function getCityTimeZone(_cityId: string): string {
  return DEFAULT_TZ;
}
