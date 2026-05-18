"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useCity } from "./CityContext";
import type { WeeklyWeatherData, DayWeather } from "@/lib/weather/types";

interface WeatherContextValue {
  /** Weather data by date */
  weatherByDate: Record<string, DayWeather>;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Refetch weather data */
  refetch: () => Promise<void>;
  /** Get weather for a specific date (returns null if >7 days or not available) */
  getWeatherForDate: (date: Date | string) => DayWeather | null;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

/** Module-level cache for weather data */
const weatherCache = new Map<string, WeeklyWeatherData>();
/** In-flight promises to deduplicate concurrent requests */
const inFlightWeather = new Map<string, Promise<WeeklyWeatherData | null>>();

export function WeatherProvider({ children }: { children: ReactNode }) {
  const { citySlug } = useCity();

  const [weatherData, setWeatherData] = useState<WeeklyWeatherData | null>(
    citySlug ? weatherCache.get(citySlug) || null : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (slug: string) => {
    // 1. Check module cache
    const cached = weatherCache.get(slug);
    if (cached) {
      setWeatherData(cached);
      return;
    }

    // 2. Check in-flight promise
    if (inFlightWeather.has(slug)) {
      setLoading(true);
      const result = await inFlightWeather.get(slug);
      if (result) setWeatherData(result);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const promise = (async () => {
      try {
        const url = `/api/weather/weekly?city=${slug}`;
        if (process.env.NODE_ENV !== "production") {
          console.info("[WeatherContext] fetching", { url, citySlug: slug });
        }

        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error("Failed to fetch weather");
        }

        const data = (await response.json()) as WeeklyWeatherData;
        weatherCache.set(slug, data);
        return data;
      } catch (err) {
        console.error("[WeatherContext] Error:", err);
        throw err;
      } finally {
        inFlightWeather.delete(slug);
      }
    })();

    inFlightWeather.set(slug, promise);

    try {
      const data = await promise;
      setWeatherData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!citySlug) {
      setWeatherData(null);
      return;
    }
    void fetchWeather(citySlug);
  }, [citySlug, fetchWeather]);

  const getWeatherForDate = useCallback(
    (date: Date | string): DayWeather | null => {
      if (!weatherData) {
        console.debug("[WeatherContext] No weather data available");
        return null;
      }

      const dateStr =
        typeof date === "string"
          ? date
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const result = weatherData.byDate[dateStr] ?? null;
      
      if (process.env.NODE_ENV !== "production") {
        console.debug("[WeatherContext] getWeatherForDate", {
          dateStr,
          found: !!result,
          availableDates: Object.keys(weatherData.byDate),
        });
      }

      return result;
    },
    [weatherData]
  );

  const value = useMemo(
    (): WeatherContextValue => ({
      weatherByDate: weatherData?.byDate ?? {},
      loading,
      error,
      refetch: () => citySlug ? fetchWeather(citySlug) : Promise.resolve(),
      getWeatherForDate,
    }),
    [weatherData, loading, error, fetchWeather, getWeatherForDate, citySlug]
  );

  return (
    <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
  );
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) {
    throw new Error("useWeather must be used within WeatherProvider");
  }
  return ctx;
}

export function useOptionalWeather(): WeatherContextValue | null {
  return useContext(WeatherContext);
}
