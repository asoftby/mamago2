import { geoCellsFor } from "@/lib/geo/geoCell";

type CoordInput = number | null | undefined | { set?: number | null };
type PlaceWriteData = Record<string, unknown>;

export type PlaceGeoCellPatch = { geoCell6: string | null; geoCell5: string | null };

function unwrap(value: unknown): { touched: boolean; value: number | null } {
  if (value === undefined) return { touched: false, value: null };
  if (value === null) return { touched: true, value: null };
  if (typeof value === "number") return { touched: true, value };
  if (typeof value === "object" && value !== null && "set" in value) {
    const set = (value as { set?: number | null }).set;
    if (set === undefined) return { touched: false, value: null };
    return { touched: true, value: set };
  }
  return { touched: false, value: null };
}

/**
 * Whether a Place write changes the coordinates, and which side still has to be
 * read from the row (partial update of only lat or only lng).
 */
export function inspectPlaceCoordinateWrite(data: PlaceWriteData | undefined): {
  touchesCoordinates: boolean;
  needsCurrentRow: boolean;
} {
  if (!data) return { touchesCoordinates: false, needsCurrentRow: false };
  if ("geoCell6" in data || "geoCell5" in data) return { touchesCoordinates: false, needsCurrentRow: false };
  const lat = unwrap(data.lat as CoordInput);
  const lng = unwrap(data.lng as CoordInput);
  return {
    touchesCoordinates: lat.touched || lng.touched,
    needsCurrentRow: lat.touched !== lng.touched,
  };
}

/**
 * Geo-cell columns that must accompany a Place write, or null when the write does
 * not touch coordinates (or already carries explicit cells, e.g. the backfill).
 * `current` supplies the untouched coordinate for partial updates.
 */
export function resolvePlaceGeoCellPatch(
  data: PlaceWriteData | undefined,
  current?: { lat: number | null; lng: number | null } | null,
): PlaceGeoCellPatch | null {
  const { touchesCoordinates } = inspectPlaceCoordinateWrite(data);
  if (!touchesCoordinates || !data) return null;
  const lat = unwrap(data.lat as CoordInput);
  const lng = unwrap(data.lng as CoordInput);
  const effectiveLat = lat.touched ? lat.value : (current?.lat ?? null);
  const effectiveLng = lng.touched ? lng.value : (current?.lng ?? null);
  const cells = geoCellsFor(effectiveLat, effectiveLng);
  return { geoCell6: cells?.geoCell6 ?? null, geoCell5: cells?.geoCell5 ?? null };
}
