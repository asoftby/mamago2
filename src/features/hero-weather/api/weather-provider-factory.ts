import type { WeatherProvider } from "./weather-provider";
import { MockWeatherProvider } from "./mock-weather-provider";
import { OpenMeteoWeatherProvider } from "./open-meteo-provider";
import { weatherDiagLog } from "../lib/weather-diag-log";

export type WeatherProviderKind = "mock" | "open-meteo";

/**
 * Reads `process.env.WEATHER_PROVIDER` (e.g. `open-meteo`). Defaults to `mock`.
 */
export function getConfiguredWeatherProviderKind(): WeatherProviderKind {
  weatherDiagLog("provider env =", process.env.WEATHER_PROVIDER);
  const raw = process.env.WEATHER_PROVIDER?.trim().toLowerCase();
  const kind: WeatherProviderKind =
    raw === "open-meteo" || raw === "open_meteo" ? "open-meteo" : "mock";
  weatherDiagLog("resolved provider kind =", kind);
  return kind;
}

/**
 * Production entry: real Open-Meteo when `WEATHER_PROVIDER=open-meteo`, else mock.
 * Override via `getHeroContext({ weatherProvider })` for tests.
 */
export function getWeatherProvider(): WeatherProvider {
  const kind = getConfiguredWeatherProviderKind();
  weatherDiagLog("creating provider:", kind);
  return kind === "open-meteo" ? new OpenMeteoWeatherProvider() : new MockWeatherProvider("sunny");
}
