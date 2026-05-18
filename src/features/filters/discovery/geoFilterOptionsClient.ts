"use client";

/** Matches {@link import("./filters.api").FilterOption} shape — kept local to avoid import cycles. */
export type GeoDiscoveryOption = {
  id: string;
  value: string;
  label: string;
};

export type MetroDistrictGeoPayload = {
  metros: GeoDiscoveryOption[];
  districts: GeoDiscoveryOption[];
};

type MetroStationRow = { id: string; name: string };
type DistrictRow = { id: string; name: string };

const metroDistrictCache = new Map<string, MetroDistrictGeoPayload>();
const metroDistrictInflight = new Map<string, Promise<MetroDistrictGeoPayload>>();

/**
 * Metro + district lists for discovery filters (public header, sheets, etc.).
 * - Dedupes concurrent callers by citySlug (single shared promise).
 * - Caches fulfilled payloads per citySlug for the session (reload clears).
 */
export async function fetchMetroDistrictFilterOptions(
  citySlug: string | null | undefined,
): Promise<MetroDistrictGeoPayload> {
  if (citySlug == null || citySlug === "") {
    return { metros: [], districts: [] };
  }

  const key = citySlug.trim();
  if (!key) {
    return { metros: [], districts: [] };
  }

  const cached = metroDistrictCache.get(key);
  if (cached) {
    return cached;
  }

  let inflight = metroDistrictInflight.get(key);
  if (!inflight) {
    inflight = (async (): Promise<MetroDistrictGeoPayload> => {
      const slug = encodeURIComponent(key);
      const [metroResponse, districtsResponse] = await Promise.all([
        fetch(`/api/geo/metro-stations?citySlug=${slug}`),
        fetch(`/api/geo/districts?citySlug=${slug}`),
      ]);

      let metros: GeoDiscoveryOption[] = [];
      let districts: GeoDiscoveryOption[] = [];

      if (metroResponse.ok) {
        const metroData = await metroResponse.json();
        metros = (metroData.metroStations || []).map((station: MetroStationRow) => ({
          id: station.id,
          value: station.id,
          label: station.name,
        }));
      } else if (process.env.NODE_ENV === "development") {
        console.warn(
          "[fetchMetroDistrictFilterOptions] metro-stations:",
          metroResponse.status,
          key,
        );
      }

      if (districtsResponse.ok) {
        const districtsData = await districtsResponse.json();
        districts = (districtsData.districts || []).map((district: DistrictRow) => ({
          id: district.id,
          value: district.id,
          label: district.name,
        }));
      } else if (process.env.NODE_ENV === "development") {
        console.warn(
          "[fetchMetroDistrictFilterOptions] districts:",
          districtsResponse.status,
          key,
        );
      }

      const payload: MetroDistrictGeoPayload = { metros, districts };
      metroDistrictCache.set(key, payload);
      return payload;
    })().finally(() => {
      metroDistrictInflight.delete(key);
    });

    metroDistrictInflight.set(key, inflight);
  }

  return inflight;
}
