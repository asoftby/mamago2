import type { WeatherProvider } from "./weather-provider";
import type { WeatherHourSlot, WeatherRawData } from "../model/types";
import { fetchJsonWithTimeout } from "../lib/fetch-json-with-timeout";
import { weatherDiagLog } from "../lib/weather-diag-log";

/** Open-Meteo returns wind in km/h; interpreter thresholds are calibrated separately. */
const KMH_TO_MS = 1 / 3.6;

export type OpenMeteoForecastJson = {
  current?: {
    time?: string;
    interval?: number;
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    apparent_temperature?: (number | null)[];
    precipitation_probability?: (number | null)[];
    precipitation?: (number | null)[];
    weather_code?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
  };
};

function num(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n;
}

function boolDay(v: unknown): boolean | null {
  if (v === 0 || v === 1) return v === 1;
  if (typeof v === "boolean") return v;
  return null;
}

/**
 * Maps Open-Meteo forecast JSON to `WeatherRawData`. Returns `null` if unusable.
 * Exported for unit tests.
 */
export function mapOpenMeteoToWeatherRawData(json: unknown): WeatherRawData | null {
  if (!json || typeof json !== "object") {
    weatherDiagLog("mapping failed: invalid payload (not an object)", json);
    return null;
  }
  const o = json as OpenMeteoForecastJson;

  const hourly = o.hourly;
  if (!hourly?.time || hourly.time.length < 8) {
    weatherDiagLog("mapping failed: forecast API expects hourly.time length >= 8", {
      hasHourly: Boolean(hourly),
      timeLen: hourly?.time?.length,
      keys: Object.keys(o),
    });
    return null;
  }

  const n = hourly.time.length;
  const slots: WeatherHourSlot[] = [];
  for (let i = 0; i < n; i++) {
    const windKmh = num(hourly.wind_speed_10m?.[i]);
    const gustKmh = num(hourly.wind_gusts_10m?.[i]);
    slots.push({
      temperature: num(hourly.temperature_2m?.[i]),
      apparentTemperature: num(hourly.apparent_temperature?.[i]),
      weatherCode: num(hourly.weather_code?.[i]),
      windSpeed: windKmh != null ? windKmh * KMH_TO_MS : null,
      windGusts: gustKmh != null ? gustKmh * KMH_TO_MS : null,
      precipitation: num(hourly.precipitation?.[i]),
      precipitationProbability: num(hourly.precipitation_probability?.[i]),
      isDay: true,
    });
  }

  const cur = o.current;
  let current: WeatherHourSlot;
  if (cur) {
    const wK = num(cur.wind_speed_10m);
    const gK = num(cur.wind_gusts_10m);
    current = {
      temperature: num(cur.temperature_2m),
      apparentTemperature: num(cur.apparent_temperature),
      weatherCode: num(cur.weather_code),
      windSpeed: wK != null ? wK * KMH_TO_MS : null,
      windGusts: gK != null ? gK * KMH_TO_MS : null,
      precipitation: num(cur.precipitation),
      precipitationProbability: slots[0]?.precipitationProbability ?? null,
      isDay: boolDay(cur.is_day),
    };
  } else {
    current = { ...slots[0]! };
  }

  return {
    current,
    hourly: slots,
  };
}

function buildOpenMeteoUrl(lat: number, lon: number, timezone: string): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone,
    forecast_days: "2",
    current: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
      "is_day",
    ].join(","),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
    ].join(","),
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  async fetchWeather(params: {
    latitude: number;
    longitude: number;
    timezone?: string;
  }): Promise<WeatherRawData | null> {
    const tz = params.timezone ?? "Europe/Minsk";
    const url = buildOpenMeteoUrl(params.latitude, params.longitude, tz);
    weatherDiagLog("Open-Meteo request:", url);
    const json = await fetchJsonWithTimeout<unknown>(url, {
      timeoutMs: 10_000,
      init: {
        next: { revalidate: 1800 },
      } as RequestInit,
    });
    if (!json) {
      weatherDiagLog("Open-Meteo response: null (fetch failed, timeout, or non-JSON)");
      return null;
    }
    const keys = typeof json === "object" && json !== null ? Object.keys(json as object) : [];
    const hourly = (json as { hourly?: { time?: unknown[] } }).hourly;
    weatherDiagLog("Open-Meteo response: ok", {
      keys,
      hourlyTimeLen: hourly?.time?.length,
    });
    const mapped = mapOpenMeteoToWeatherRawData(json);
    if (!mapped) {
      weatherDiagLog("Open-Meteo: mapOpenMeteoToWeatherRawData returned null");
    }
    return mapped;
  }
}
