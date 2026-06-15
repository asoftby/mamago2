"use client";

/**
 * API client for fetching discovery filter options from the database
 */

import * as React from "react";
import type { AgeDef } from "@/server/discovery/ageMapping";
import { fetchMetroDistrictFilterOptions } from "./geoFilterOptionsClient";
import { useOptionalHeaderDiscoveryFilters } from "./headerDiscoveryFiltersContext";

export type FilterOption = {
  id: string;
  value: string;
  label: string;
};

export type AgeOption = FilterOption & {
  group?: string;
  order?: number;
  minMonths?: number;
  maxMonths?: number | null;
};

export type DiscoveryFilterOptions = {
  ages: AgeOption[];
  metros: FilterOption[];
  districts: FilterOption[];
};

/**
 * Fetch discovery filter options from the API
 *
 * @param citySlug - City slug (e.g., "minsk")
 * @returns Filter options for age, metro, and district
 */
export async function fetchDiscoveryFilters(
  citySlug: string = "minsk",
): Promise<DiscoveryFilterOptions> {
  try {
    const [filtersResponse, geoPair] = await Promise.all([
      fetch("/api/discovery/filters", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }),
      fetchMetroDistrictFilterOptions(citySlug),
    ]);

    const filtersData = filtersResponse.ok
      ? await filtersResponse.json()
      : { filters: [] };
    if (!filtersResponse.ok && process.env.NODE_ENV === "development") {
      console.warn(
        "[fetchDiscoveryFilters] /api/discovery/filters:",
        filtersResponse.status,
      );
    }

    const filters = filtersData.filters || [];

    const agesRaw: FilterOption[] = [];

    for (const filter of filters) {
      if (filter.slug === "age" && filter.options) {
        for (const option of filter.options) {
          agesRaw.push({
            id: option.id,
            value: option.value,
            label: option.label,
          });
        }
      }
    }

    const { AGE_DEFS } = await import("@/server/discovery/ageMapping");
    const ageMap = new Map<string, AgeDef>(AGE_DEFS.map((d) => [d.value, d]));
    const ages: AgeOption[] = agesRaw
      .map((o) => {
        const def = ageMap.get(o.value);
        if (def) {
          return {
            ...o,
            label: def.label,
            group: def.group,
            order: def.order,
            minMonths: def.minMonths,
            maxMonths: def.maxMonths,
          };
        }
        return { ...o, order: 9999 };
      })
      .sort((a, b) => {
        const ao = a.order ?? 9999;
        const bo = b.order ?? 9999;
        if (ao !== bo) return ao - bo;
        return a.label.localeCompare(b.label, "ru");
      });

    const metros: FilterOption[] = geoPair.metros;
    const districts: FilterOption[] = geoPair.districts;

    return {
      ages,
      metros,
      districts,
    };
  } catch (error) {
    console.error("Error fetching discovery filters:", error);

    return {
      ages: [],
      metros: [],
      districts: [],
    };
  }
}

const EMPTY_OPTIONS: DiscoveryFilterOptions = {
  ages: [],
  metros: [],
  districts: [],
};

/**
 * Client-side hook for fetching filter options
 * Use this in client components
 */
type UseDiscoveryFilterOptionsConfig = {
  defer?: boolean;
};

export function useDiscoveryFilterOptions(
  citySlug: string | null = "minsk",
  config: UseDiscoveryFilterOptionsConfig = {},
) {
  const { defer = false } = config;
  const headerFilters = useOptionalHeaderDiscoveryFilters();

  const matchesHeaderScope =
    headerFilters != null &&
    citySlug != null &&
    headerFilters.citySlug === citySlug;

  const headerLoading = headerFilters?.loading ?? false;
  const headerHasLoaded = headerFilters?.hasLoaded ?? false;
  const headerError = headerFilters?.error ?? null;
  const headerMetros = headerFilters?.metros;
  const headerDistricts = headerFilters?.districts;
  const loadGeoFilters = headerFilters?.loadGeoFilters;

  const [options, setOptions] = React.useState<DiscoveryFilterOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        if (!citySlug) {
          if (mounted) {
            setOptions(EMPTY_OPTIONS);
            setLoading(false);
            setError(null);
          }
          return;
        }

        if (matchesHeaderScope && loadGeoFilters) {
          if (!headerHasLoaded && !defer) {
            await loadGeoFilters(citySlug);
          }

          if (!headerHasLoaded && !headerLoading) {
            if (mounted) {
              setOptions(EMPTY_OPTIONS);
              setLoading(false);
              setError(headerError);
            }
            return;
          }

          if (headerLoading) {
            if (mounted) setLoading(true);
            return;
          }

          if (mounted) {
            setOptions({
              ages: [],
              metros: headerMetros ?? [],
              districts: headerDistricts ?? [],
            });
            setLoading(false);
            setError(headerError);
          }
          return;
        }

        if (mounted) setLoading(true);

        const pair = await fetchMetroDistrictFilterOptions(citySlug);

        if (!mounted) return;

        setOptions({
          ages: [],
          metros: pair.metros,
          districts: pair.districts,
        });
        setError(null);
        setLoading(false);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("useDiscoveryFilterOptions:", err);
        }
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [
    citySlug,
    defer,
    matchesHeaderScope,
    headerLoading,
    headerHasLoaded,
    headerError,
    headerMetros,
    headerDistricts,
    loadGeoFilters,
  ]);

  return { options, loading, error };
}

export { fetchMetroDistrictFilterOptions } from "./geoFilterOptionsClient";
