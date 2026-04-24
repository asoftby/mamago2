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

const STORAGE_KEY = "mamago.selectedCity";

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
  const [storedCity, setStoredCity] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const cityFromQuery = searchParams.get("city");
  const resolvedCity = useMemo(
    () =>
      resolveCityContext({
        pathname,
        cityFromQuery,
        preferredCitySlug: storedCity,
        allowedCitySlugs: cities.map((city) => city.slug),
      }),
    [pathname, cityFromQuery, storedCity, cities],
  );

  const citySlug = resolvedCity.citySlug ?? DEFAULT_CITY_SLUG;
  const cityName = resolvedCity.cityName ?? citySlug;

  useEffect(() => {
    if (resolvedCity.source !== "route" || !resolvedCity.citySlug) return;
    try {
      localStorage.setItem(STORAGE_KEY, resolvedCity.citySlug);
    } catch {
      /* ignore */
    }
    queueMicrotask(() => setStoredCity(resolvedCity.citySlug));
  }, [resolvedCity]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[CityContext] city resolved", {
        pathname,
        cityFromQuery,
        storedCity,
        resolvedCity,
      });
    }
  }, [pathname, cityFromQuery, storedCity, resolvedCity]);

  const setCity = useCallback(
    (slug: string) => {
      try {
        localStorage.setItem(STORAGE_KEY, slug);
      } catch {
        /* ignore */
      }
      setStoredCity(slug);
      router.push(`/${slug}`);
    },
    [router],
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
        try {
          localStorage.setItem(STORAGE_KEY, slug);
        } catch {
          /* ignore */
        }
        router.push(`/${slug}`);
      },
      appendCityQuery: (href: string) => appendCityQueryToHref(href, citySlug),
    };
  }, [ctx, pathname, router]);
}
