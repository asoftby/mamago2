"use client";

import { useCity } from "@/contexts/CityContext";
import { getCityHomeHref } from "@/lib/header/getCityHomeHref";

export function useCityHomeHref(): string {
  const { citySlug } = useCity();
  return getCityHomeHref(citySlug);
}
