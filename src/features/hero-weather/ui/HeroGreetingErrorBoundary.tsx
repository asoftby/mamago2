"use client";

import React from "react";

import type { HeroGreetingModel } from "../lib/get-hero-context";
import { stripLeadingMicrocopyEmoji } from "../lib/strip-leading-microcopy-emoji";
import { HeroMoodIcon } from "./HeroMoodIcon";
import { HeroGreeting } from "./HeroGreeting";

type HeroGreetingErrorBoundaryProps = {
  model: HeroGreetingModel;
};

type HeroGreetingErrorBoundaryState = {
  hasError: boolean;
};

export class HeroGreetingErrorBoundary extends React.Component<
  HeroGreetingErrorBoundaryProps,
  HeroGreetingErrorBoundaryState
> {
  state: HeroGreetingErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HeroGreetingErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[HeroGreeting] render failed", error);
  }

  render() {
    const { model } = this.props;

    if (!this.state.hasError) {
      return <HeroGreeting model={model} />;
    }

    const fallbackSummary = stripLeadingMicrocopyEmoji(model.microcopy) || model.microcopy;

    return (
      <div
        className="relative px-1"
        data-hero-fallback="error-boundary"
        data-hero-weather-scenario={model.weatherScenario}
      >
        {fallbackSummary ? (
          <p className="flex items-center gap-3 text-sm font-medium tracking-tight text-neutral-600 sm:text-[15px] [text-wrap:balance]">
            <HeroMoodIcon
              scenario={model.weatherScenario}
              timeOfDay={model.timeOfDay}
              maxTemperatureC={model.maxTemperatureC}
              size={56}
            />
            <span className="min-w-0 whitespace-pre-wrap">{fallbackSummary}</span>
          </p>
        ) : null}

        <div className="mt-2 flex items-start">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-3xl [text-wrap:balance]">
            <span className="whitespace-pre-wrap">{model.title}</span>
          </h1>
        </div>
      </div>
    );
  }
}
