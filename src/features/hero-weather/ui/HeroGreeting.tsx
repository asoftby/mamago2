"use client";

import { motion } from "framer-motion";
import type { HeroGreetingModel } from "../lib/get-hero-context";
import { stripLeadingMicrocopyEmoji } from "../lib/strip-leading-microcopy-emoji";
import { HeroMoodIcon } from "./HeroMoodIcon";

export type HeroGreetingProps = {
  model: HeroGreetingModel;
};

export function HeroGreeting({ model }: HeroGreetingProps) {
  return (
    <motion.div
      className="relative px-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      data-hero-preferred-context={model.preferredContext ?? model.activityBias}
      data-hero-weather-scenario={model.weatherScenario}
    >
      {model.microcopy ? (
        <p className="flex items-center gap-3 text-sm font-medium tracking-tight text-neutral-600 sm:text-[15px] [text-wrap:balance]">
          <HeroMoodIcon
            scenario={model.weatherScenario}
            timeOfDay={model.timeOfDay}
            maxTemperatureC={model.maxTemperatureC}
          />
          <span className="min-w-0 whitespace-pre-wrap">
            {stripLeadingMicrocopyEmoji(model.microcopy)}
          </span>
        </p>
      ) : null}

      <div className="mt-2 flex items-start">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-3xl [text-wrap:balance]">
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
