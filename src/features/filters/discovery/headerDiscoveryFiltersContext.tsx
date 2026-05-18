"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMetroDistrictFilterOptions,
  type GeoDiscoveryOption,
} from "./geoFilterOptionsClient";

export type HeaderDiscoveryFiltersContextValue = {
  citySlug: string;
  metros: GeoDiscoveryOption[];
  districts: GeoDiscoveryOption[];
  loading: boolean;
  error: Error | null;
};

const HeaderDiscoveryFiltersContext = createContext<
  HeaderDiscoveryFiltersContextValue | undefined
>(undefined);

/** Module-level cache for geo options */
const geoCache = new Map<string, { metros: GeoDiscoveryOption[]; districts: GeoDiscoveryOption[] }>();
/** In-flight promises to deduplicate concurrent requests */
const inFlightGeo = new Map<string, Promise<{ metros: GeoDiscoveryOption[]; districts: GeoDiscoveryOption[] }>>();

/**
 * Single geo fetch + cache entry for the active public header city (`useCity().citySlug`).
 * Nested consumers use {@link useDiscoveryFilterOptions} with the same slug without refetching.
 */
export function HeaderDiscoveryFiltersProvider({
  citySlug,
  children,
}: {
  citySlug: string;
  children: ReactNode;
}) {
  const cached = geoCache.get(citySlug);
  const [metros, setMetros] = useState<GeoDiscoveryOption[]>(cached?.metros ?? []);
  const [districts, setDistricts] = useState<GeoDiscoveryOption[]>(cached?.districts ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 1. Check module cache
    const existing = geoCache.get(citySlug);
    if (existing) {
      setMetros(existing.metros);
      setDistricts(existing.districts);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      // 2. Check in-flight promise
      if (inFlightGeo.has(citySlug)) {
        setLoading(true);
        try {
          const pair = await inFlightGeo.get(citySlug)!;
          if (!cancelled) {
            setMetros(pair.metros);
            setDistricts(pair.districts);
            setLoading(false);
          }
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err : new Error("Unknown error"));
        }
        return;
      }

      setLoading(true);
      setError(null);

      const promise = (async () => {
        try {
          const pair = await fetchMetroDistrictFilterOptions(citySlug);
          geoCache.set(citySlug, pair);
          return pair;
        } finally {
          inFlightGeo.delete(citySlug);
        }
      })();

      inFlightGeo.set(citySlug, promise);

      try {
        const pair = await promise;
        if (!cancelled) {
          setMetros(pair.metros);
          setDistricts(pair.districts);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
          setMetros([]);
          setDistricts([]);
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [citySlug]);

  const value = useMemo(
    (): HeaderDiscoveryFiltersContextValue => ({
      citySlug,
      metros,
      districts,
      loading,
      error,
    }),
    [citySlug, metros, districts, loading, error],
  );

  return (
    <HeaderDiscoveryFiltersContext.Provider value={value}>
      {children}
    </HeaderDiscoveryFiltersContext.Provider>
  );
}

export function useOptionalHeaderDiscoveryFilters() {
  return useContext(HeaderDiscoveryFiltersContext);
}

export function useHeaderDiscoveryFilters(): HeaderDiscoveryFiltersContextValue {
  const ctx = useContext(HeaderDiscoveryFiltersContext);
  if (!ctx) {
    throw new Error(
      "useHeaderDiscoveryFilters must be used within HeaderDiscoveryFiltersProvider",
    );
  }
  return ctx;
}
