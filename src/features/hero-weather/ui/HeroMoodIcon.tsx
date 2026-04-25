"use client";

import { cn } from "@/lib/utils";
import type { WeatherScenario, TimeOfDay } from "../model/types";
import { resolveHomeWeatherScenario, getWeatherIconName } from "../lib/weather-scenario-layer";

export type HeroMoodIconProps = {
  scenario: WeatherScenario | string;
  timeOfDay?: TimeOfDay;
  maxTemperatureC?: number | null;
  className?: string;
  size?: number;
};

export function HeroMoodIcon({
  scenario,
  timeOfDay = "day",
  maxTemperatureC = null,
  className,
  size = 28,
}: HeroMoodIconProps) {
  const dayScenario = resolveHomeWeatherScenario({
    scenario: typeof scenario === "string" ? (scenario as WeatherScenario) : scenario,
    maxTemperatureC,
  });
  const iconName = getWeatherIconName({ scenario: dayScenario, timeOfDay });

  return (
    <span
      className={cn(
        "pointer-events-none inline-flex shrink-0 select-none items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <img
        src={`/meteocons/fill/${iconName}.svg`}
        alt=""
        className="object-contain"
        width={size}
        height={size}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}
