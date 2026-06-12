import type { WeatherRawData } from "../model/types";
import type { WeatherOutdoorScore, WeatherSnapshot } from "../model/weather-snapshot";

function formatCondition(code: number | null): string | null {
  if (code == null) return null;
  if (code === 0) return "солнечно";
  if (code === 1) return "преимущественно ясно";
  if (code === 2) return "переменная облачность";
  if (code === 3) return "облачно";
  if (code === 45 || code === 48) return "туманно";
  if (code >= 51 && code <= 67) return "дождливо";
  if (code >= 71 && code <= 86) return "снег";
  if (code >= 95) return "гроза";
  return "переменная погода";
}

function max(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function min(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

function resolveDailyCondition(raw: WeatherRawData): string | null {
  const codes = raw.hourly
    .slice(0, 24)
    .map((slot) => slot.weatherCode)
    .filter((value): value is number => value != null);

  if (codes.length === 0) {
    return formatCondition(raw.current.weatherCode);
  }

  const significantCode =
    codes.find((code) => code >= 95) ??
    codes.find((code) => code >= 71) ??
    codes.find((code) => code >= 51) ??
    codes.find((code) => code >= 45) ??
    codes[0];

  return formatCondition(significantCode ?? null);
}

function resolveOutdoorScore(input: {
  currentTemp: number | null;
  currentCondition: string | null;
  dailyMaxTemp: number | null;
  precipitationProbability: number | null;
  windSpeed: number | null;
}): WeatherOutdoorScore | null {
  const { currentTemp, currentCondition, dailyMaxTemp, precipitationProbability, windSpeed } = input;

  if (
    (currentTemp != null && currentTemp < 5) ||
    (dailyMaxTemp != null && dailyMaxTemp < 8) ||
    (precipitationProbability != null && precipitationProbability >= 60) ||
    (windSpeed != null && windSpeed >= 12)
  ) {
    return "BAD_FOR_OUTDOOR";
  }

  if (
    (precipitationProbability != null && precipitationProbability >= 30) ||
    (currentTemp != null && currentTemp < 12) ||
    currentCondition === "облачно" ||
    currentCondition === "дождливо" ||
    currentCondition === "туманно" ||
    currentCondition === "переменная погода"
  ) {
    return "MIXED";
  }

  if (
    currentTemp == null &&
    dailyMaxTemp == null &&
    precipitationProbability == null &&
    windSpeed == null
  ) {
    return null;
  }

  return "GOOD_FOR_OUTDOOR";
}

export function deriveWeatherSnapshot(input: {
  raw: WeatherRawData;
  citySlug: string;
  cityName: string;
  cityId?: string;
  updatedAt?: Date;
}): WeatherSnapshot {
  const { raw, citySlug, cityName, cityId } = input;
  const currentTemp = raw.current.temperature;
  const currentFeelsLike = raw.current.apparentTemperature;
  const currentCondition = formatCondition(raw.current.weatherCode);
  const todaySlots = raw.hourly.slice(0, 24);
  const dailyMinTemp = min(todaySlots.map((slot) => slot.temperature));
  const dailyMaxTemp = max(todaySlots.map((slot) => slot.temperature));
  const precipitationProbability = max([
    raw.current.precipitationProbability,
    ...todaySlots.map((slot) => slot.precipitationProbability),
  ]);
  const windSpeed = raw.current.windSpeed;
  const dailyCondition = resolveDailyCondition(raw);
  const outdoorScore = resolveOutdoorScore({
    currentTemp,
    currentCondition,
    dailyMaxTemp,
    precipitationProbability,
    windSpeed,
  });

  return {
    cityId,
    citySlug,
    cityName,
    provider: "open-meteo",
    currentTemp,
    currentFeelsLike,
    currentCondition,
    dailyMinTemp,
    dailyMaxTemp,
    dailyCondition,
    precipitationProbability,
    windSpeed,
    outdoorScore,
    updatedAt: (input.updatedAt ?? new Date()).toISOString(),
  };
}
