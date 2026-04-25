/**
 * City coordinates for weather API
 */

export interface CityCoordinates {
  lat: number;
  lon: number;
}

const CITY_COORDINATES: Record<string, CityCoordinates> = {
  minsk: { lat: 53.9, lon: 27.5667 },
  brest: { lat: 52.0975, lon: 23.7340 },
  gomel: { lat: 52.4345, lon: 30.9754 },
  grodno: { lat: 53.6693, lon: 23.8131 },
  mogilev: { lat: 53.9007, lon: 30.3313 },
  vitebsk: { lat: 55.1904, lon: 30.2049 },
};

export function getCityCoordinates(citySlug: string): CityCoordinates | null {
  return CITY_COORDINATES[citySlug.toLowerCase()] ?? null;
}
