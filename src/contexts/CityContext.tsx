"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCityFromPath } from "@/lib/intent";
import { appendCityQuery as appendCityQueryToHref } from "@/lib/city/appendCityQuery";
import { resolveCitySlug } from "@/lib/city/resolveCitySlug";

const STORAGE_KEY = "mamago.selectedCity";

type CityContextValue = {
  citySlug: string;
  setCity: (slug: string) => void;
  appendCityQuery: (href: string) => string;
};

const CityContext = createContext<CityContextValue | null>(null);

function CityProviderInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [storedCity, setStoredCity] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Sync storedCity when pathname changes (extract city from path)
  const cityFromPath = useMemo(() => getCityFromPath(pathname), [pathname]);
  
  useEffect(() => {
    if (!cityFromPath) return;
    try {
      localStorage.setItem(STORAGE_KEY, cityFromPath);
    } catch {
      /* ignore */
    }
    queueMicrotask(() => setStoredCity(cityFromPath));
  }, [cityFromPath]);

  const cityFromQuery = searchParams.get("city");
  const citySlug = useMemo(
    () => resolveCitySlug(pathname, cityFromQuery, storedCity),
    [pathname, cityFromQuery, storedCity],
  );

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
    () => ({ citySlug, setCity, appendCityQuery }),
    [citySlug, setCity, appendCityQuery],
  );

  return (
    <CityContext.Provider value={value}>{children}</CityContext.Provider>
  );
}

export function CityProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex flex-col bg-background" />}
    >
      <CityProviderInner>{children}</CityProviderInner>
    </Suspense>
  );
}

/** Контекст города (null, если не внутри CityProvider). */
export function useOptionalCity(): CityContextValue | null {
  return useContext(CityContext);
}

/**
 * Город для ссылок и навигации. Если провайдера нет (редкий SSR / граница RSC),
 * slug берётся из pathname + дефолт minsk — без падения.
 */
export function useCity(): CityContextValue {
  const ctx = useOptionalCity();
  const pathname = usePathname();
  const router = useRouter();

  return useMemo(() => {
    if (ctx) return ctx;
    const citySlug = resolveCitySlug(pathname, null, null);
    return {
      citySlug,
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
