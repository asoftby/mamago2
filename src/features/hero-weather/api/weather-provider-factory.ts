import type { WeatherProvider } from "./weather-provider";
import { OpenMeteoWeatherProvider } from "./open-meteo-provider";
import { weatherDiagLog } from "../lib/weather-diag-log";

export type WeatherProviderKind = "open-meteo";

/**
 * Reads `process.env.WEATHER_PROVIDER`. Only real Open-Meteo is supported.
 */
export function getConfiguredWeatherProviderKind(): WeatherProviderKind {
  weatherDiagLog("provider env =", process.env.WEATHER_PROVIDER);
  weatherDiagLog("resolved provider kind =", "open-meteo");
  return "open-meteo";
}

export function getWeatherProvider(): WeatherProvider {
  const kind = getConfiguredWeatherProviderKind();
  weatherDiagLog("creating provider:", kind);
  return new OpenMeteoWeatherProvider();
}
