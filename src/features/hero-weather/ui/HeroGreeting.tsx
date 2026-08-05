"use client";

import { motion } from "framer-motion";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import type { HeroGreetingModel } from "../lib/get-hero-context";
import { stripLeadingMicrocopyEmoji } from "../lib/strip-leading-microcopy-emoji";
import { HeroMoodIcon } from "./HeroMoodIcon";
import type { WeatherSnapshot } from "../model/weather-snapshot";

export type HeroGreetingProps = {
  model: HeroGreetingModel;
};

const HERO_WEATHER_FALLBACK = "Погода временно недоступна — подберём идеи для любого дня.";
const WEATHER_SUMMARY_DASH = " — ";

function cityInLocative(snapshot: WeatherSnapshot): string | null {
  if (snapshot.citySlug) return getCityDisplayName(snapshot.citySlug);
  return snapshot.cityName || null;
}

function WeatherSummaryText({ text }: { text: string }) {
  const dashIdx = text.indexOf(WEATHER_SUMMARY_DASH);
  if (dashIdx === -1) {
    return (
      <span className="min-w-0 font-pt-serif" style={{ fontWeight: 400, color: "#141210" }}>
        {text}
      </span>
    );
  }

  const before = text.slice(0, dashIdx);
  const after = text.slice(dashIdx + WEATHER_SUMMARY_DASH.length);

  return (
    <span className="min-w-0 font-pt-serif" style={{ fontWeight: 400, color: "#141210" }}>
      {before}
      {WEATHER_SUMMARY_DASH}
      <span className="italic text-primary">{after}</span>
    </span>
  );
}

function formatSignedTemp(value: number | null): string | null {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

function buildCurrentSentence(snapshot: WeatherSnapshot): string | null {
  const temp = formatSignedTemp(snapshot.currentTemp);
  const condition = snapshot.currentCondition;

  if (temp && condition) {
    if (snapshot.outdoorScore === "GOOD_FOR_OUTDOOR") {
      return `Сейчас ${temp} и ${condition}.`;
    }
    return `Сейчас ${temp}, ${condition}.`;
  }

  if (temp) return `Сейчас ${temp}.`;
  if (condition) return `Сейчас ${condition}.`;
  return null;
}

function buildRangeSentence(snapshot: WeatherSnapshot): string | null {
  const min = formatSignedTemp(snapshot.dailyMinTemp);
  const max = formatSignedTemp(snapshot.dailyMaxTemp);
  const cityName = cityInLocative(snapshot);
  const basePrefix = cityName ? `Сегодня в ${cityName}` : "Сегодня";

  if (min && max) {
    if (snapshot.outdoorScore === "GOOD_FOR_OUTDOOR") {
      return `${basePrefix} от ${min} до ${max} — хороший день для прогулки.`;
    }
    if (snapshot.outdoorScore === "BAD_FOR_OUTDOOR") {
      return `${basePrefix} от ${min} до ${max} — лучше выбирать места в помещении.`;
    }
    if ((snapshot.precipitationProbability ?? 0) >= 30) {
      return `${basePrefix} от ${min} до ${max}, возможен дождь.`;
    }
    return `${basePrefix} от ${min} до ${max}, погода переменчивая.`;
  }

  if (max) return `${basePrefix} до ${max}.`;
  if (min) return `${basePrefix} от ${min}.`;
  return null;
}

function buildHeroWeatherSummary(snapshot: WeatherSnapshot | null | undefined): string {
  if (!snapshot) return HERO_WEATHER_FALLBACK;

  const current = buildCurrentSentence(snapshot);
  const range = buildRangeSentence(snapshot);

  if (current && range) return `${current} ${range}`;
  if (current) return current;
  if (range) return range;
  return HERO_WEATHER_FALLBACK;
}

export function HeroGreeting({ model }: HeroGreetingProps) {
  const fallbackMicrocopy = stripLeadingMicrocopyEmoji(model.microcopy);
  const displaySummary = buildHeroWeatherSummary(model.weatherSnapshot) || fallbackMicrocopy || HERO_WEATHER_FALLBACK;

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
            scenario={model.weatherScenario}
            timeOfDay={model.timeOfDay}
            maxTemperatureC={model.maxTemperatureC}
            size={56}
          />
          <WeatherSummaryText text={displaySummary} />
        </p>
      ) : null}

    </motion.div>
  );
}
