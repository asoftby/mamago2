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
  const [storedCity, setStoredCity] = useState<string | null>(null);

  useEffect(() => {
    try {
      setStoredCity(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const fromPath = getCityFromPath(pathname);
    if (!fromPath) return;
    try {
      localStorage.setItem(STORAGE_KEY, fromPath);
    } catch {
      /* ignore */
    }
    setStoredCity(fromPath);
  }, [pathname]);

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

/** When CityProvider is still behind Suspense or missing, returns null (use pathname fallbacks). */
export function useOptionalCity(): CityContextValue | null {
  return useContext(CityContext);
}

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) {
    throw new Error("useCity must be used within CityProvider");
  }
  return ctx;
}
