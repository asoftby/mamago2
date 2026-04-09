"use client";

import type { ComponentType } from "react";
import type { Transition } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import {
  CloudDrizzle,
  CloudRain,
  CloudSun,
  Cloudy,
  CloudLightning,
  Snowflake,
  Sparkles,
  Sun,
  ThermometerSnowflake,
  ThermometerSun,
  TriangleAlert,
  Wind,
} from "lucide-react";

import type { WeatherScenario } from "../model/types";
import { normalizeWeatherScenario } from "../model/anti-repeat-types";
import { cn } from "@/lib/utils";

export type HeroMoodIconProps = {
  scenario: WeatherScenario | string;
  className?: string;
};

type MoodIcon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

type MoodSpec = {
  Icon: MoodIcon;
  /** Container + icon tint — calm, light UI */
  badgeClass: string;
  iconClass: string;
};

const MOOD_BY_SCENARIO: Record<WeatherScenario, MoodSpec> = {
  great_outdoor: {
    Icon: Sun,
    badgeClass:
      "bg-amber-50/90 text-amber-900/55 ring-amber-950/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    iconClass: "text-amber-800/75",
  },
  good_outdoor: {
    Icon: CloudSun,
    badgeClass:
      "bg-sky-50/85 text-sky-900/45 ring-sky-950/[0.05] shadow-[0_1px_2px_rgba(15,23,42,0.035)]",
    iconClass: "text-sky-800/70",
  },
  mixed_outdoor: {
    Icon: Cloudy,
    badgeClass:
      "bg-stone-50/90 text-stone-700/50 ring-stone-900/[0.05] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    iconClass: "text-stone-700/65",
  },
  rain_indoor: {
    Icon: CloudDrizzle,
    badgeClass:
      "bg-slate-100/90 text-slate-700/50 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.045)]",
    iconClass: "text-slate-700/70",
  },
  heavy_rain_indoor: {
    Icon: CloudRain,
    badgeClass:
      "bg-slate-100/95 text-slate-800/55 ring-slate-900/[0.07] shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
    iconClass: "text-slate-800/75",
  },
  windy_caution: {
    Icon: Wind,
    badgeClass:
      "bg-neutral-100/90 text-neutral-700/50 ring-neutral-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    iconClass: "text-neutral-700/68",
  },
  cold_mixed: {
    Icon: ThermometerSnowflake,
    badgeClass:
      "bg-slate-50/95 text-slate-700/48 ring-slate-800/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    iconClass: "text-slate-700/72",
  },
  snow_indoor: {
    Icon: Snowflake,
    badgeClass:
      "bg-sky-50/88 text-sky-900/45 ring-sky-950/[0.05] shadow-[0_1px_2px_rgba(15,23,42,0.035)]",
    iconClass: "text-sky-800/68",
  },
  storm_alert: {
    Icon: CloudLightning,
    badgeClass:
      "bg-violet-50/90 text-violet-900/48 ring-violet-950/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    iconClass: "text-violet-900/60",
  },
  ice_alert: {
    Icon: TriangleAlert,
    badgeClass:
      "bg-cyan-50/88 text-cyan-950/45 ring-cyan-950/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    iconClass: "text-cyan-900/58",
  },
  hot_caution: {
    Icon: ThermometerSun,
    badgeClass:
      "bg-orange-50/88 text-orange-950/45 ring-orange-950/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    iconClass: "text-orange-900/58",
  },
  unknown: {
    Icon: Sparkles,
    badgeClass:
      "bg-neutral-50/95 text-neutral-600/50 ring-neutral-900/[0.05] shadow-[0_1px_2px_rgba(15,23,42,0.035)]",
    iconClass: "text-neutral-600/65",
  },
};

type MotionPreset = {
  animate: Record<string, number | number[]>;
  transition: Transition;
};

function motionForScenario(scenario: WeatherScenario, reduced: boolean | null): MotionPreset {
  const still: MotionPreset = {
    animate: { opacity: 1, y: 0, x: 0, scale: 1 },
    transition: { duration: 0 },
  };
  if (reduced) return still;

  switch (scenario) {
    case "great_outdoor":
      return {
        animate: { scale: [1, 1.04, 1], opacity: [0.92, 1, 0.92] },
        transition: {
          duration: 5.5,
          repeat: Infinity,
          ease: [0.45, 0, 0.55, 1] as [number, number, number, number],
        },
      };
    case "good_outdoor":
      return {
        animate: { y: [0, -2, 0] },
        transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
      };
    case "mixed_outdoor":
      return {
        animate: { y: [0, -1.2, 0] },
        transition: { duration: 7, repeat: Infinity, ease: "easeInOut" },
      };
    case "rain_indoor":
      return {
        animate: { y: [0, 1.8, 0] },
        transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
      };
    case "heavy_rain_indoor":
      return {
        animate: { y: [0, 2.2, 0] },
        transition: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
      };
    case "windy_caution":
      return {
        animate: { x: [0, 2, 0, -1.5, 0] },
        transition: { duration: 6.5, repeat: Infinity, ease: "easeInOut" },
      };
    case "cold_mixed":
    case "snow_indoor":
      return {
        animate: { y: [0, -1.5, 0] },
        transition: { duration: 5.2, repeat: Infinity, ease: "easeInOut" },
      };
    case "storm_alert":
      return {
        animate: { opacity: [0.88, 1, 0.88] },
        transition: { duration: 4.8, repeat: Infinity, ease: "easeInOut" },
      };
    case "ice_alert":
      return {
        animate: { x: [0, 0.8, 0, -0.8, 0] },
        transition: { duration: 7, repeat: Infinity, ease: "easeInOut" },
      };
    case "hot_caution":
      return {
        animate: { scale: [1, 1.035, 1] },
        transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
      };
    case "unknown":
      return {
        animate: { opacity: [0.9, 1, 0.9] },
        transition: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
      };
    default:
      return still;
  }
}

export function HeroMoodIcon({ scenario: rawScenario, className }: HeroMoodIconProps) {
  const scenario = normalizeWeatherScenario(rawScenario);
  const reduced = useReducedMotion();
  const { Icon, badgeClass, iconClass } = MOOD_BY_SCENARIO[scenario];
  const { animate, transition } = motionForScenario(scenario, Boolean(reduced));

  return (
    <motion.span
      className={cn(
        "pointer-events-none inline-flex size-[30px] shrink-0 select-none items-center justify-center rounded-full ring-1 ring-inset",
        badgeClass,
        className,
      )}
      aria-hidden
      animate={animate}
      transition={transition}
    >
      <Icon className={cn("size-[17px]", iconClass)} strokeWidth={1.35} aria-hidden />
    </motion.span>
  );
}
