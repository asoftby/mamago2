/** IANA timezone for Belarus cities (hero weather / Open-Meteo). */
export type CityWeatherCoords = {
  lat: number;
  lon: number;
  timezone: string;
};

/**
 * Fallback coordinates when DB coords are missing.
 * Extend as new city pages ship; prefer passing `cityCenterLat`/`cityCenterLng` from Prisma `City`.
 */
const BY_CITY_SLUG: Record<string, CityWeatherCoords> = {
  minsk: { lat: 53.9006, lon: 27.559, timezone: "Europe/Minsk" },
  /** Пример второго города — скорректировать при запуске */
  grodno: { lat: 53.6694, lon: 23.8131, timezone: "Europe/Minsk" },
  brest: { lat: 52.0976, lon: 23.7341, timezone: "Europe/Minsk" },
  vitebsk: { lat: 55.1904, lon: 30.2049, timezone: "Europe/Minsk" },
  gomel: { lat: 52.4345, lon: 30.9754, timezone: "Europe/Minsk" },
  mogilev: { lat: 53.9168, lon: 30.3449, timezone: "Europe/Minsk" },
};

const DEFAULT_FALLBACK: CityWeatherCoords = BY_CITY_SLUG.minsk;

export function getCityCoordsBySlug(slug: string | undefined | null): CityWeatherCoords | null {
  if (slug == null || slug === "") return null;
  const key = slug.trim().toLowerCase();
  return BY_CITY_SLUG[key] ?? null;
}

export function getDefaultBelarusFallbackCoords(): CityWeatherCoords {
  return DEFAULT_FALLBACK;
}
