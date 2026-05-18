"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMetroDistrictFilterOptions,
  getCachedMetroDistrictFilterOptions,
  type GeoDiscoveryOption,
} from "./geoFilterOptionsClient";

export type HeaderDiscoveryFiltersContextValue = {
  citySlug: string;
  metros: GeoDiscoveryOption[];
  districts: GeoDiscoveryOption[];
  loading: boolean;
  error: Error | null;
  hasLoaded: boolean;
  loadGeoFilters: (
    citySlug?: string | null | undefined,
  ) => Promise<{ metros: GeoDiscoveryOption[]; districts: GeoDiscoveryOption[] }>;
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
  const cached = getCachedMetroDistrictFilterOptions(citySlug);
  const [state, setState] = useState(() => ({
    citySlug,
    metros: cached?.metros ?? [],
    districts: cached?.districts ?? [],
    loading: false,
    error: null as Error | null,
    hasLoaded: Boolean(cached),
  }));
  const activeCitySlugRef = useRef(citySlug);
  useEffect(() => {
    activeCitySlugRef.current = citySlug;
  }, [citySlug]);

  const resolvedState = useMemo(
    () =>
      state.citySlug === citySlug
        ? state
        : {
            citySlug,
            metros: cached?.metros ?? [],
            districts: cached?.districts ?? [],
            loading: false,
            error: null as Error | null,
            hasLoaded: Boolean(cached),
          },
    [cached, citySlug, state],
  );

  const loadGeoFilters = useCallback(
    async (requestedCitySlug?: string | null) => {
      const targetCitySlug = requestedCitySlug ?? activeCitySlugRef.current;
      const cachedForTarget = getCachedMetroDistrictFilterOptions(targetCitySlug);

      if (cachedForTarget) {
        if (targetCitySlug === activeCitySlugRef.current) {
          setState({
            citySlug: targetCitySlug,
            metros: cachedForTarget.metros,
            districts: cachedForTarget.districts,
            loading: false,
            error: null,
            hasLoaded: true,
          });
        }
        return cachedForTarget;
      }

      if (targetCitySlug === activeCitySlugRef.current) {
        setState((prev) => ({
          citySlug: targetCitySlug,
          metros:
            prev.citySlug === targetCitySlug ? prev.metros : [],
          districts:
            prev.citySlug === targetCitySlug ? prev.districts : [],
          loading: true,
          error: null,
          hasLoaded: prev.citySlug === targetCitySlug ? prev.hasLoaded : false,
        }));
      }

      try {
        const pair = await fetchMetroDistrictFilterOptions(targetCitySlug);

        if (targetCitySlug === activeCitySlugRef.current) {
          setState({
            citySlug: targetCitySlug,
            metros: pair.metros,
            districts: pair.districts,
            loading: false,
            error: null,
            hasLoaded: true,
          });
        }

        return pair;
      } catch (err) {
        if (targetCitySlug === activeCitySlugRef.current) {
          setState({
            citySlug: targetCitySlug,
            metros: [],
            districts: [],
            loading: false,
            error: err instanceof Error ? err : new Error("Unknown error"),
            hasLoaded: false,
          });
        }
        throw err;
      }
    },
    [],
  );

  const value = useMemo(
    (): HeaderDiscoveryFiltersContextValue => ({
      citySlug,
      metros: resolvedState.metros,
      districts: resolvedState.districts,
      loading: resolvedState.loading,
      error: resolvedState.error,
      hasLoaded: resolvedState.hasLoaded,
      loadGeoFilters,
    }),
    [citySlug, resolvedState, loadGeoFilters],
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
