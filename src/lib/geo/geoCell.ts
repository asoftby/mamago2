/**
 * Geohash cells used as "nearby" clusters by the day-scenario engine.
 *
 * geoCell6 (~1.2 x 0.6 km) is the walking-distance cluster, geoCell5 (~4.9 x 4.9 km)
 * is the coarse city cluster for car mode. Pure and dependency-free so that the
 * Prisma write hook, the backfill script and the engine share one implementation.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export const GEO_CELL_FINE_PRECISION = 6;
export const GEO_CELL_COARSE_PRECISION = 5;

export type GeoCells = { geoCell6: string; geoCell5: string };

export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // (0, 0) is the "unset" value of several importers and sits in the ocean.
    !(lat === 0 && lng === 0)
  );
}

export function encodeGeohash(lat: number, lng: number, precision: number): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch <<= 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch <<= 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export type GeohashBounds = { latMin: number; latMax: number; lngMin: number; lngMax: number };

export function decodeGeohashBounds(hash: string): GeohashBounds {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let evenBit = true;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) throw new Error(`invalid geohash character: ${c}`);
    for (let mask = 16; mask > 0; mask >>= 1) {
      const set = (idx & mask) !== 0;
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (set) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (set) latMin = mid;
        else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { latMin, latMax, lngMin, lngMax };
}

/** Both cluster levels for a coordinate pair, or null for unusable coordinates. */
export function geoCellsFor(lat: unknown, lng: unknown): GeoCells | null {
  if (!isValidLatLng(lat, lng)) return null;
  const latitude = lat as number;
  const longitude = lng as number;
  const geoCell6 = encodeGeohash(latitude, longitude, GEO_CELL_FINE_PRECISION);
  return { geoCell6, geoCell5: geoCell6.slice(0, GEO_CELL_COARSE_PRECISION) };
}

/** The cell itself plus its (up to) 8 neighbours; computed, never queried. */
export function geoCellWithNeighbors(cell: string): string[] {
  const b = decodeGeohashBounds(cell);
  const dLat = b.latMax - b.latMin;
  const dLng = b.lngMax - b.lngMin;
  const centerLat = (b.latMin + b.latMax) / 2;
  const centerLng = (b.lngMin + b.lngMax) / 2;
  const out = new Set<string>();
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const lat = centerLat + i * dLat;
      if (lat < -90 || lat > 90) continue;
      let lng = centerLng + j * dLng;
      if (lng > 180) lng -= 360;
      if (lng < -180) lng += 360;
      out.add(encodeGeohash(lat, lng, cell.length));
    }
  }
  return [...out];
}
