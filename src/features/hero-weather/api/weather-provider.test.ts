import assert from "node:assert/strict";

import type { WeatherProvider } from "./weather-provider";
import { mapOpenMeteoToWeatherRawData } from "./open-meteo-provider";
import { getConfiguredWeatherProviderKind, getWeatherProvider } from "./weather-provider-factory";
import { MockWeatherProvider } from "./mock-weather-provider";
import { OpenMeteoWeatherProvider } from "./open-meteo-provider";
import { getHeroContext } from "../lib/get-hero-context";

// --- 1. successful Open-Meteo shape → WeatherRawData ---

{
  const sample = {
    current: {
      time: "2025-01-01T12:00",
      temperature_2m: 10,
      apparent_temperature: 9,
      precipitation: 0,
      weather_code: 1,
      wind_speed_10m: 18,
      wind_gusts_10m: 36,
      is_day: 1,
    },
    hourly: {
      time: Array.from({ length: 24 }, (_, i) => `2025-01-01T${String(i).padStart(2, "0")}:00`),
      temperature_2m: Array(24).fill(10),
      apparent_temperature: Array(24).fill(9),
      precipitation_probability: Array(24).fill(10),
      precipitation: Array(24).fill(0),
      weather_code: Array(24).fill(1),
      wind_speed_10m: Array(24).fill(18),
      wind_gusts_10m: Array(24).fill(36),
    },
  };
  const raw = mapOpenMeteoToWeatherRawData(sample);
  assert.ok(raw);
  assert.equal(raw!.hourly.length, 24);
  assert.equal(raw!.current.temperature, 10);
  assert.ok(raw!.current.windGusts != null && raw!.current.windGusts > 0);
}

// --- 2. partial / empty → null, no throw ---

{
  assert.equal(mapOpenMeteoToWeatherRawData(null), null);
  assert.equal(mapOpenMeteoToWeatherRawData({}), null);
  assert.equal(
    mapOpenMeteoToWeatherRawData({
      hourly: { time: ["a"], temperature_2m: [1] },
    }),
    null,
  );
}

// --- 3. factory respects env ---

{
  const prev = process.env.WEATHER_PROVIDER;
  try {
    process.env.WEATHER_PROVIDER = "mock";
    assert.equal(getConfiguredWeatherProviderKind(), "mock");
    assert.ok(getWeatherProvider() instanceof MockWeatherProvider);

    process.env.WEATHER_PROVIDER = "open-meteo";
    assert.equal(getConfiguredWeatherProviderKind(), "open-meteo");
    assert.ok(getWeatherProvider() instanceof OpenMeteoWeatherProvider);
  } finally {
    process.env.WEATHER_PROVIDER = prev;
  }
}

// --- 4–5. getHeroContext (async) ---

void (async () => {
  const nullProvider: WeatherProvider = {
    async fetchWeather() {
      return null;
    },
  };
  const m1 = await getHeroContext({
    weatherProvider: nullProvider,
    personaMode: "guest",
  });
  assert.equal(m1.debug?.weatherSource, "fallback");

  const m2 = await getHeroContext({
    weatherProvider: new MockWeatherProvider("sunny"),
    personaMode: "guest",
  });
  assert.equal(m2.debug?.weatherSource, "mock");

   
  console.log("weather-provider tests: OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
