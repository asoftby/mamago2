import assert from "node:assert/strict";

import { getFallbackHeroModel, getHeroContext } from "./get-hero-context";
import { resolveDayTime } from "./weather-scenario-layer";
import type { WeatherProvider } from "../api/weather-provider";
import { getWeatherRankingBoost } from "./weather-scenario-layer";
import type { ActivityMock } from "@/types/activity";

// --- 1. getFallbackHeroModel derives real time-of-day (not hardcoded "day") ---

{
  const now = new Date();
  const expected = resolveDayTime(now, "Europe/Minsk");
  const model = getFallbackHeroModel({
    cityName: "Минск",
    personaMode: "guest",
    citySlug: "minsk",
    now,
  });
  assert.equal(model.timeOfDay, expected);
  assert.equal(model.debug?.timeOfDay, expected);
  assert.equal(model.weatherDayScenario, "cloudy_mixed");
  assert.equal(model.weatherSnapshot, null);
  assert.equal(model.debug?.weatherSource, "fallback");
}

// --- 2. getFallbackHeroModel falls back to guest persona + no timezone crash for unknown city ---

{
  const model = getFallbackHeroModel({ citySlug: "unknown-city-slug" });
  assert.equal(model.personaMode, "guest");
  assert.ok(["morning", "day", "evening", "night"].includes(model.timeOfDay));
}

// --- 3. getHeroContext: provider failure (throw) still resolves fast and carries city context into the fallback ---

void (async () => {
  const throwingProvider: WeatherProvider = {
    async fetchWeather() {
      throw new Error("simulated provider failure");
    },
  };

  const start = Date.now();
  const model = await getHeroContext({
    weatherProvider: throwingProvider,
    citySlug: "minsk",
    cityName: "Минск",
    personaMode: "guest",
  });
  const elapsed = Date.now() - start;

  assert.equal(model.debug?.weatherSource, "fallback");
  assert.ok(elapsed < 500, `expected near-instant fallback, got ${elapsed}ms`);
  assert.ok(["morning", "day", "evening", "night"].includes(model.timeOfDay));

  // --- 4. getHeroContext: provider returning null resolves to the same deterministic fallback ---

  const nullProvider: WeatherProvider = {
    async fetchWeather() {
      return null;
    },
  };
  const nullModel = await getHeroContext({
    weatherProvider: nullProvider,
    citySlug: "minsk",
    cityName: "Минск",
    personaMode: "self",
  });
  assert.equal(nullModel.debug?.weatherSource, "fallback");
  assert.equal(nullModel.personaMode, "self");

  // --- 5. fallback weather scenario never breaks Kuda ranking boost computation ---

  const rankingContext = getFallbackHeroModel({ citySlug: "minsk" });
  const activity: ActivityMock = {
    id: "a1",
    type: "EVENT_FIXED",
    title: "Прогулка в парке",
    description: "",
    image: "",
    ageFrom: 0,
    ageTo: 12,
    currency: "BYN",
    tags: ["outdoor"],
  };
  const boost = getWeatherRankingBoost(activity, {
    scenario: rankingContext.weatherDayScenario,
    timeOfDay: rankingContext.timeOfDay,
  });
  assert.equal(typeof boost, "number");

  console.log("get-hero-context tests: OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
