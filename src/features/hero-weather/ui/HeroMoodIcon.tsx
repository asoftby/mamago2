"use client";

import { useEffect, useMemo, useState } from "react";
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
  const fallbackIconName = timeOfDay === "night" ? "overcast-night" : "overcast-day";
  const primarySrc = useMemo(() => `/meteocons/fill/${iconName}.svg`, [iconName]);
  const fallbackSrc = useMemo(() => `/meteocons/fill/${fallbackIconName}.svg`, [fallbackIconName]);
  const [imgSrc, setImgSrc] = useState(primarySrc);

  useEffect(() => {
    setImgSrc(primarySrc);
  }, [primarySrc]);

  return (
    <span
      className={cn(
        "pointer-events-none inline-flex shrink-0 select-none items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <img
        src={imgSrc}
        alt=""
        className="object-contain"
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        onError={() => {
          if (imgSrc !== fallbackSrc) {
            setImgSrc(fallbackSrc);
          }
        }}
      />
    </span>
  );
}
