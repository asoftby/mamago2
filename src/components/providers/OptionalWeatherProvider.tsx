"use client";

import type { ReactNode } from "react";
import { WeatherProvider, useOptionalWeather } from "@/contexts/WeatherContext";

interface OptionalWeatherProviderProps {
  children: ReactNode;
}

/**
 * Mount weather fetching only for weather-aware UI while preserving any existing
 * higher-level weather scope if one is already present.
 */
export function OptionalWeatherProvider({
  children,
}: OptionalWeatherProviderProps) {
  const weather = useOptionalWeather();

  if (weather) {
    return <>{children}</>;
  }

  return <WeatherProvider>{children}</WeatherProvider>;
}
