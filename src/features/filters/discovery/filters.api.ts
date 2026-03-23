/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API client for fetching discovery filter options from the database
 */

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
  citySlug: string = "minsk"
): Promise<DiscoveryFilterOptions> {
  try {
    // Fetch all data in parallel
    const [filtersResponse, metroResponse, districtsResponse] = await Promise.all([
      fetch("/api/discovery/filters", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }),
      fetch(`/api/geo/metro-stations?citySlug=${encodeURIComponent(citySlug)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }),
      fetch(`/api/geo/districts?citySlug=${encodeURIComponent(citySlug)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }),
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

    const metroData = metroResponse.ok
      ? await metroResponse.json()
      : { metroStations: [] };
    if (!metroResponse.ok && process.env.NODE_ENV === "development") {
      console.warn(
        "[fetchDiscoveryFilters] metro-stations:",
        metroResponse.status,
        citySlug,
      );
    }

    const districtsData = districtsResponse.ok
      ? await districtsResponse.json()
      : { districts: [] };
    if (!districtsResponse.ok && process.env.NODE_ENV === "development") {
      console.warn(
        "[fetchDiscoveryFilters] districts:",
        districtsResponse.status,
        citySlug,
      );
    }
    
    // Transform API responses to our format
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

    // Enrich ages with canonical mapping (group/order/min/max)
    const { AGE_DEFS } = await import("@/server/discovery/ageMapping");
    const ageMap = new Map(AGE_DEFS.map((d: any) => [d.value, d]));
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

    // Transform metro stations
    const metros: FilterOption[] = (metroData.metroStations || []).map((station: any) => ({
      id: station.id,
      value: station.id,
      label: station.name,
    }));

    // Transform districts
    const districts: FilterOption[] = (districtsData.districts || []).map((district: any) => ({
      id: district.id,
      value: district.id,
      label: district.name,
    }));
    
    return {
      ages,
      metros,
      districts,
    };
  } catch (error) {
    console.error("Error fetching discovery filters:", error);
    
    // Return empty arrays on error - graceful degradation
    return {
      ages: [],
      metros: [],
      districts: [],
    };
  }
}

/**
 * Client-side hook for fetching filter options
 * Use this in client components
 */
export function useDiscoveryFilterOptions(citySlug: string | null = "minsk") {
  const [options, setOptions] = React.useState<DiscoveryFilterOptions>({
    ages: [],
    metros: [],
    districts: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        
        // If no city slug, return empty options
        if (!citySlug) {
          if (mounted) {
            setOptions({
              ages: [],
              metros: [],
              districts: [],
            });
            setLoading(false);
          }
          return;
        }
        
        const slug = encodeURIComponent(citySlug);
        const [metroResponse, districtsResponse] = await Promise.all([
          fetch(`/api/geo/metro-stations?citySlug=${slug}`),
          fetch(`/api/geo/districts?citySlug=${slug}`),
        ]);

        let metros: FilterOption[] = [];
        let districts: FilterOption[] = [];

        if (metroResponse.ok) {
          const metroData = await metroResponse.json();
          metros = (metroData.metroStations || []).map((station: any) => ({
            id: station.id,
            value: station.id,
            label: station.name,
          }));
        } else if (process.env.NODE_ENV === "development") {
          console.warn(
            "[useDiscoveryFilterOptions] metro-stations:",
            metroResponse.status,
            citySlug,
          );
        }

        if (districtsResponse.ok) {
          const districtsData = await districtsResponse.json();
          districts = (districtsData.districts || []).map((district: any) => ({
            id: district.id,
            value: district.id,
            label: district.name,
          }));
        } else if (process.env.NODE_ENV === "development") {
          console.warn(
            "[useDiscoveryFilterOptions] districts:",
            districtsResponse.status,
            citySlug,
          );
        }
        
        const data = {
          ages: [], // Skip ages for now to simplify
          metros,
          districts,
        };
        
        if (mounted) {
          setOptions(data);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("useDiscoveryFilterOptions:", err);
        }
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [citySlug]);

  return { options, loading, error };
}

// Add React import for the hook
import * as React from "react";
