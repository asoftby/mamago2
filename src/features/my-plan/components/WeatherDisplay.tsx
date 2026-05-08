"use client";

import { useMemo } from "react";
import { differenceInDays } from "date-fns";
import { useOptionalWeather } from "@/contexts/WeatherContext";
import { useOptionalCity } from "@/contexts/CityContext";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { HeroMoodIcon } from "@/features/hero-weather";
import { formatWeatherText, formatDateOnly, type TimeOfDay } from "@/lib/weather/formatWeatherText";
import { cn } from "@/lib/utils";

interface WeatherDisplayProps {
  /** Selected date */
  date: Date;
  /** Time of day to show (default: evening) */
  timeOfDay?: TimeOfDay;
  /** Additional CSS classes */
  className?: string;
}

function mapWeatherCodeToScenario(code: number): string {
  // Open-Meteo codes -> hero weather scenario family
  if (code >= 95) return "storm_alert";
  if (code === 45 || code === 48) return "rain_indoor";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain_indoor";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow_indoor";
  if (code === 0 || code === 1) return "great_outdoor";
  if (code === 2) return "good_outdoor";
  if (code === 3) return "mixed_outdoor";
  return "unknown";
}

export function WeatherDisplay({
  date,
  timeOfDay = "evening",
  className,
}: WeatherDisplayProps) {
  const weather = useOptionalWeather();
  const cityCtx = useOptionalCity();
  const cityName = cityCtx?.citySlug ? getCityDisplayName(cityCtx.citySlug) : null;

  const iconTimeOfDay: "morning" | "day" | "evening" | "night" =
    timeOfDay === "evening" && new Date().getHours() >= 21 ? "night" : timeOfDay;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const daysFromNow = differenceInDays(targetDate, today);

  let content;
  if (daysFromNow > 7) {
    content = { text: formatDateOnly(date), showWeather: false, weatherCode: null as number | null };
  } else {
    const weatherData = weather?.getWeatherForDate(date);
    const weatherText = formatWeatherText(date, weatherData ?? null, timeOfDay, cityName);

    if (weatherText) {
      content = { text: weatherText, showWeather: true, weatherCode: weatherData?.[timeOfDay]?.code ?? null };
    } else {
      content = { text: formatDateOnly(date), showWeather: false, weatherCode: null as number | null };
    }
  }

  if (weather?.loading) {
    return (
      <div className={cn("rounded-xl bg-neutral-50 px-3 py-2.5", className)}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 flex-1 animate-pulse rounded bg-neutral-200" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl bg-neutral-50 px-3 py-2.5", className)}>
      <p className="flex items-center gap-2 text-sm font-medium tracking-tight text-neutral-600">
        {content.showWeather && (
          <HeroMoodIcon
            scenario={mapWeatherCodeToScenario(content.weatherCode ?? 3)}
            timeOfDay={iconTimeOfDay}
            size={40}
            className="shrink-0"
          />
        )}
        <span className="min-w-0 whitespace-pre-wrap">{content.text}</span>
      </p>
    </div>
  );
}
