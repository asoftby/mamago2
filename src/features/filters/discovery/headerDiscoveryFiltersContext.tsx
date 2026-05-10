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
  const [metros, setMetros] = useState<GeoDiscoveryOption[]>([]);
  const [districts, setDistricts] = useState<GeoDiscoveryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });

    void fetchMetroDistrictFilterOptions(citySlug)
      .then((pair) => {
        if (cancelled) return;
        setMetros(pair.metros);
        setDistricts(pair.districts);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
          setMetros([]);
          setDistricts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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
