"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { appendCityQuery as appendCityQueryToHref } from "@/lib/city/appendCityQuery";
import {
  DEFAULT_CITY_SLUG,
  type ResolvedCityContext,
  resolveCityContext,
} from "@/lib/city/resolveCityContext";
import { usePublicCityOptions } from "@/lib/city/usePublicCityOptions";
import { readTerritoryCookieClient, writeTerritoryCookieClient } from "@/lib/territory/territoryCookie";

/** Legacy storage: read once to migrate the visitor's choice into the `mg_territory` cookie, then removed. */
const LEGACY_STORAGE_KEY = "mamago.selectedCity";

function readStoredSelection(): string | null {
  const fromCookie = readTerritoryCookieClient();
  if (fromCookie) return fromCookie;
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      writeTerritoryCookieClient(legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return readTerritoryCookieClient();
  } catch {
    return null;
  }
}

type CityContextValue = ResolvedCityContext & {
  citySlug: string;
  cityName: string;
  setCity: (slug: string) => void;
  appendCityQuery: (href: string) => string;
};

const CityContext = createContext<CityContextValue | null>(null);

function CityProviderInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { cities } = usePublicCityOptions();

  // 1. Initial city from URL or default (SSR-safe source of truth)
  const cityFromQuery = searchParams.get("city");
  const initialResolved = useMemo(
    () =>
      resolveCityContext({
        pathname,
        cityFromQuery,
        preferredCitySlug: null, // Don't use storage on init to avoid hydration flicker
        allowedCitySlugs: cities.map((city) => city.slug),
      }),
    [pathname, cityFromQuery, cities],
  );

  const [storedCity, setStoredCity] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 2. Hydrate storage city on mount
  useEffect(() => {
    const nextStoredCity = readStoredSelection();

    queueMicrotask(() => {
      setStoredCity(nextStoredCity);
      setIsInitialized(true);
    });
  }, []);

  const resolvedCity = useMemo(() => {
    // If we have a city in URL, it ALWAYS wins over storage
    if (initialResolved.source === "route") {
      return initialResolved;
    }

    // If no city in URL, use storage as fallback (only after hydration)
    if (isInitialized && storedCity) {
      return resolveCityContext({
        pathname,
        cityFromQuery,
        preferredCitySlug: storedCity,
        allowedCitySlugs: cities.map((city) => city.slug),
      });
    }

    return initialResolved;
  }, [initialResolved, isInitialized, storedCity, pathname, cityFromQuery, cities]);

  const citySlug = resolvedCity.citySlug ?? DEFAULT_CITY_SLUG;
  const cityName = resolvedCity.cityName ?? citySlug;

  // 3. Sync storage with stable city (but NO router.push/refresh here)
  useEffect(() => {
    if (!isInitialized || !resolvedCity.citySlug) return;
    if (resolvedCity.citySlug === storedCity) return;

    // Only update storage if it's a route-based city or a default
    writeTerritoryCookieClient(resolvedCity.citySlug);
    queueMicrotask(() => {
      setStoredCity(resolvedCity.citySlug);
    });
  }, [resolvedCity.citySlug, storedCity, isInitialized]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && isInitialized) {
      console.debug("[CityContext] city resolved", {
        source: resolvedCity.source,
        citySlug,
        isCityRoute: resolvedCity.isCityRoute,
        isInitialized,
      });
    }
  }, [citySlug, resolvedCity.source, resolvedCity.isCityRoute, isInitialized]);

  const setCity = useCallback(
    (slug: string) => {
      if (slug === citySlug) return;

      if (process.env.NODE_ENV !== "production") {
        console.debug("[CityContext] user city change", { from: citySlug, to: slug });
      }

      writeTerritoryCookieClient(slug);
      setStoredCity(slug);
      router.push(`/${slug}`);
    },
    [router, citySlug],
  );

  const appendCityQuery = useCallback(
    (href: string) => appendCityQueryToHref(href, citySlug),
    [citySlug],
  );

  const value = useMemo(
    () => ({ ...resolvedCity, citySlug, cityName, setCity, appendCityQuery }),
    [resolvedCity, citySlug, cityName, setCity, appendCityQuery],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function CityProvider({ children }: { children: React.ReactNode }) {
  return <CityProviderInner>{children}</CityProviderInner>;
}

export function useOptionalCity(): CityContextValue | null {
  return useContext(CityContext);
}

export function useCity(): CityContextValue {
  const ctx = useOptionalCity();
  const pathname = usePathname();
  const router = useRouter();

  return useMemo(() => {
    if (ctx) return ctx;

    const resolvedCity = resolveCityContext({
      pathname,
      cityFromQuery: null,
      preferredCitySlug: null,
    });
    const citySlug = resolvedCity.citySlug ?? DEFAULT_CITY_SLUG;
    const cityName = resolvedCity.cityName ?? citySlug;

    return {
      ...resolvedCity,
      citySlug,
      cityName,
      setCity: (slug: string) => {
        writeTerritoryCookieClient(slug);
        router.push(`/${slug}`);
      },
      appendCityQuery: (href: string) => appendCityQueryToHref(href, citySlug),
    };
  }, [ctx, pathname, router]);
}
