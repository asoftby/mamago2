"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import type { HeroGreetingModel } from "../lib/get-hero-context";
import { stripLeadingMicrocopyEmoji } from "../lib/strip-leading-microcopy-emoji";
import { HeroMoodIcon } from "./HeroMoodIcon";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useOptionalWeather } from "@/contexts/WeatherContext";
import { useOptionalCity } from "@/contexts/CityContext";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { generateWeatherSummary, codeToCondition } from "@/lib/weather/generateWeatherSummary";

export type HeroGreetingProps = {
  model: HeroGreetingModel;
};

function mapWeatherCodeToScenario(code: number): string {
  if (code >= 95) return "storm_alert";
  if (code === 45 || code === 48) return "rain_indoor";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain_indoor";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow_indoor";
  if (code === 0 || code === 1) return "great_outdoor";
  if (code === 2) return "good_outdoor";
  if (code === 3) return "mixed_outdoor";
  return "unknown";
}

export function HeroGreeting({ model }: HeroGreetingProps) {
  const { applied } = useDiscoveryFilters();
  const weather = useOptionalWeather();
  const cityCtx = useOptionalCity();
  const citySlug = cityCtx?.citySlug ?? null;

  // Compute timeOfDay client-side from browser's local time — fixes timezone mismatch with SSR
  const clientTimeOfDay = useMemo((): "morning" | "day" | "evening" | "night" => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 11) return "morning";
    if (hour >= 12 && hour <= 17) return "day";
    if (hour >= 18 && hour <= 21) return "evening";
    return "night";
  }, []);

  // For weather slot lookup: "night" maps to "evening" slot (no night slot in DayWeather)
  const weatherTimeOfDay = clientTimeOfDay === "night" ? "evening" : clientTimeOfDay;
  // For icon: pass "night" directly so HeroMoodIcon picks night variant
  const iconTimeOfDay = clientTimeOfDay;

  const selectedDates = useMemo(() => {
    const now = new Date();
    if (applied.whenPreset === "TODAY") return [now];
    if (applied.whenPreset === "TOMORROW") return [addDays(now, 1)];
    if (applied.whenPreset === "WEEKEND") {
      const base = new Date(now);
      base.setHours(12, 0, 0, 0);
      const day = base.getDay();
      const daysToSaturday = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
      const saturday = addDays(base, daysToSaturday);
      const sunday = addDays(saturday, 1);
      return [saturday, sunday];
    }
    if (applied.dateFrom) {
      const from = new Date(`${applied.dateFrom}T12:00:00`);
      if (Number.isNaN(from.getTime())) return [now];
      if (applied.dateTo && applied.dateTo !== applied.dateFrom) {
        const to = new Date(`${applied.dateTo}T12:00:00`);
        if (!Number.isNaN(to.getTime())) return [from, to];
      }
      return [from];
    }
    return [now];
  }, [applied.whenPreset, applied.dateFrom, applied.dateTo]);

  const rangeLabel = useMemo(() => {
    if (applied.whenPreset === "TODAY") return "Сегодня";
    if (applied.whenPreset === "TOMORROW") return "Завтра";
    if (applied.whenPreset === "WEEKEND") return "На выходных";
    if (applied.dateFrom && applied.dateTo && applied.dateFrom !== applied.dateTo) {
      const from = new Date(`${applied.dateFrom}T12:00:00`);
      const to = new Date(`${applied.dateTo}T12:00:00`);
      return `С ${format(from, "d MMMM", { locale: ru })} по ${format(to, "d MMMM", { locale: ru })}`;
    }
    return "Сегодня";
  }, [applied.whenPreset, applied.dateFrom, applied.dateTo]);

  const weatherSummary = useMemo(() => {
    // No city — no weather
    if (!citySlug) return null;
    if (!weather || weather.loading) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // All dates must be within [today, +7]
    const allInRange = selectedDates.every((d) => {
      const normalized = new Date(d);
      normalized.setHours(0, 0, 0, 0);
      const diff = differenceInCalendarDays(normalized, today);
      return diff >= 0 && diff <= 7;
    });
    if (!allInRange) return null;

    const days = selectedDates
      .map((date) => {
        const data = weather.getWeatherForDate(date);
        if (!data) return null;
        const slot = data[weatherTimeOfDay];
        return {
          date: data.date,
          dayOfWeek: data.weekday,
          tempMax: slot.temp,
          tempMin: data.morning.temp,
          condition: codeToCondition(slot.code),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    if (days.length === 0) return null;

    // City name in prepositional case ("Минске", "Гомеле", etc.)
    const cityName = getCityDisplayName(citySlug);
    return generateWeatherSummary(days, cityName, rangeLabel);
  }, [citySlug, selectedDates, weather, weatherTimeOfDay, rangeLabel]);

  // Icon scenario from first date
  const weatherScenario = useMemo(() => {
    if (!weather || !citySlug || !selectedDates[0]) return model.weatherScenario;
    const data = weather.getWeatherForDate(selectedDates[0]);
    if (!data) return model.weatherScenario;
    return mapWeatherCodeToScenario(data[weatherTimeOfDay].code);
  }, [weather, citySlug, selectedDates, weatherTimeOfDay, model.weatherScenario]);

  const cityDisplayName = citySlug ? getCityDisplayName(citySlug) : null;
  const weatherPrefix = cityDisplayName && rangeLabel ? `${rangeLabel} в ${cityDisplayName}` : null;

  const fallbackMicrocopy = stripLeadingMicrocopyEmoji(model.microcopy);
  const displaySummary = weatherSummary ?? fallbackMicrocopy ?? model.microcopy;

  // Split italic weather tail into text + numeric parts for mixed font rendering
  const italicTail = (weatherSummary && weatherPrefix && displaySummary.startsWith(weatherPrefix))
    ? displaySummary.slice(weatherPrefix.length)
    : null;
  const italicParts = italicTail
    ? (() => {
        const m = italicTail.match(/^([\s\S]*\S)(\s+[+\-±]?\d[\s\S]*)$/);
        return m ? { text: m[1], numeric: m[2] } : { text: italicTail, numeric: "" };
      })()
    : null;

  return (
    <motion.div
      className="relative px-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      data-hero-preferred-context={model.preferredContext ?? model.activityBias}
      data-hero-weather-scenario={model.weatherScenario}
    >
      {displaySummary ? (
        <p className="flex items-center gap-3 tracking-tight [text-wrap:balance]" style={{ fontSize: 18 }}>
          <HeroMoodIcon
            scenario={weatherSummary ? weatherScenario : model.weatherScenario}
            timeOfDay={iconTimeOfDay}
            maxTemperatureC={model.maxTemperatureC}
            size={56}
          />
          <span className="min-w-0" style={{ fontFamily: "Georgia, serif", fontWeight: 400, color: "#141210" }}>
            {italicParts ? (
              <>
                {weatherPrefix}
                <em style={{ fontStyle: "italic", color: "#C24E22" }}>
                  {italicParts.text}
                </em>
                {italicParts.numeric && (
                  <em style={{ fontStyle: "italic", color: "#C24E22", fontFamily: "var(--font-display), Georgia, serif" }}>
                    {italicParts.numeric}
                  </em>
                )}
              </>
            ) : (
              displaySummary
            )}
          </span>
        </p>
      ) : null}

      <div className="mt-2 flex items-start">
        <h1 className="min-w-0 flex-1 leading-tight [text-wrap:balance]" style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 40, color: "#141210", letterSpacing: "-.02em" }}>
          <span className="whitespace-pre-wrap">{model.title}</span>
        </h1>
      </div>

      {model.subtitle ? (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 sm:text-[15px] [text-wrap:balance]">
          <span className="whitespace-pre-wrap">{model.subtitle}</span>
        </p>
      ) : null}
    </motion.div>
  );
}
