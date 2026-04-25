import type {
  WeatherRawData,
  WeatherHourSlot,
  WeatherScenario,
  ActivityBias,
  TimeOfDay,
  HeroWeatherContext,
} from "./types";
import { resolveDayTime } from "../lib/weather-scenario-layer";

/** Среднее по непустым числам */
function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Максимум по непустым числам */
function max(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

// ── scenario resolution ───────────────────────────────────────────────────────

function resolveScenario(slot: WeatherHourSlot): WeatherScenario {
  const {
    apparentTemperature: feels,
    windSpeed,
    windGusts,
    precipitation,
    precipitationProbability: rainProb,
    weatherCode,
  } = slot;

  // Ice / snow (WMO codes 71–77 = snow, 85–86 = snow showers)
  const isSnow =
    weatherCode !== null &&
    ((weatherCode >= 71 && weatherCode <= 77) ||
      weatherCode === 85 ||
      weatherCode === 86);

  if (isSnow) return "snow_indoor";

  // Freezing
  if (feels !== null && feels < 0) return "cold_mixed";

  // Heavy rain
  if (precipitation !== null && precipitation > 1) return "heavy_rain_indoor";

  // Rain likely
  if (rainProb !== null && rainProb >= 60) return "rain_indoor";

  // Wind caution: account for both sustained wind and gusts.
  // In practice, strong sustained wind can feel uncomfortable even when gust peak
  // is slightly below the old threshold.
  if ((windSpeed !== null && windSpeed >= 10) || (windGusts !== null && windGusts >= 12)) {
    return "windy_caution";
  }

  // Heat
  if (feels !== null && feels > 27) return "hot_caution";

  // Good weather
  if (feels !== null && feels >= 18) return "great_outdoor";
  if (feels !== null && feels >= 10) return "good_outdoor";

  return "mixed_outdoor";
}

function biasFromScenario(scenario: WeatherScenario): ActivityBias {
  switch (scenario) {
    case "great_outdoor":
    case "good_outdoor":
      return "outdoor";
    case "rain_indoor":
    case "heavy_rain_indoor":
    case "snow_indoor":
      return "indoor";
    case "storm_alert":
    case "ice_alert":
    case "windy_caution":
    case "hot_caution":
      return "caution";
    default:
      return "mixed";
  }
}

function emojiFromScenario(scenario: WeatherScenario): string {
  switch (scenario) {
    case "great_outdoor":   return "☀️";
    case "good_outdoor":    return "🌤";
    case "mixed_outdoor":   return "⛅";
    case "rain_indoor":     return "🌧";
    case "heavy_rain_indoor": return "🌧";
    case "windy_caution":   return "🌬";
    case "cold_mixed":      return "🧥";
    case "snow_indoor":     return "❄️";
    case "storm_alert":     return "⛈";
    case "ice_alert":       return "⚠️";
    case "hot_caution":     return "🌡️";
    default:                return "🌤";
  }
}

// ── main export ───────────────────────────────────────────────────────────────

export function interpretWeather(
  raw: WeatherRawData,
  now: Date,
  timezone?: string,
): HeroWeatherContext {
  const timeOfDay = resolveDayTime(now, timezone);

  // 1. Severe warnings take priority
  const severeWarning = raw.warnings?.find((w) => w.severity === "severe");
  if (severeWarning) {
    const scenario: WeatherScenario =
      severeWarning.type === "ice" ? "ice_alert" : "storm_alert";
    return {
      scenario,
      activityBias: "caution",
      timeOfDay,
      emoji: emojiFromScenario(scenario),
      hasWarning: true,
      maxTemperatureC: raw.current.temperature,
    };
  }

  const hasWarning = (raw.warnings?.length ?? 0) > 0;

  // 2. Choose analysis window
  let analysisSlot: WeatherHourSlot;

  if (timeOfDay === "morning") {
    // Morning: look ahead at midday hours (indices 12–17 in hourly array)
    const midday = raw.hourly.slice(12, 18);
    if (midday.length > 0) {
      analysisSlot = {
        temperature: avg(midday.map((h) => h.temperature)),
        apparentTemperature: avg(midday.map((h) => h.apparentTemperature)),
        weatherCode: midday[0]?.weatherCode ?? null,
        windSpeed: avg(midday.map((h) => h.windSpeed)),
        windGusts: max(midday.map((h) => h.windGusts)),
        precipitation: max(midday.map((h) => h.precipitation)),
        precipitationProbability: max(midday.map((h) => h.precipitationProbability)),
        isDay: true,
      };
    } else {
      analysisSlot = raw.current;
    }
  } else {
    // Day / evening: current + next 2–3 hours
    const next = raw.hourly.slice(0, 3);
    if (next.length > 0) {
      analysisSlot = {
        temperature: avg([raw.current.temperature, ...next.map((h) => h.temperature)]),
        apparentTemperature: avg([
          raw.current.apparentTemperature,
          ...next.map((h) => h.apparentTemperature),
        ]),
        weatherCode: raw.current.weatherCode,
        windSpeed: avg([raw.current.windSpeed, ...next.map((h) => h.windSpeed)]),
        windGusts: max([raw.current.windGusts, ...next.map((h) => h.windGusts)]),
        precipitation: max([raw.current.precipitation, ...next.map((h) => h.precipitation)]),
        precipitationProbability: max([
          raw.current.precipitationProbability,
          ...next.map((h) => h.precipitationProbability),
        ]),
        isDay: raw.current.isDay,
      };
    } else {
      analysisSlot = raw.current;
    }
  }

  const scenario = resolveScenario(analysisSlot);
  const activityBias = biasFromScenario(scenario);
  const emoji = emojiFromScenario(scenario);
  const maxTemperatureC = max([
    analysisSlot.temperature,
    analysisSlot.apparentTemperature,
    raw.current.temperature,
    raw.current.apparentTemperature,
    ...raw.hourly.slice(0, 12).flatMap((slot) => [slot.temperature, slot.apparentTemperature]),
  ]);

  return { scenario, activityBias, timeOfDay, emoji, hasWarning, maxTemperatureC };
}
