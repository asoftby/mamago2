import { MockWeatherProvider } from "../api/mock-weather-provider";
import { OpenMeteoWeatherProvider } from "../api/open-meteo-provider";
import type { WeatherProvider } from "../api/weather-provider";
import { getWeatherProvider } from "../api/weather-provider-factory";
import { generateHeroCopyWithSelection, type HeroPersonaContext } from "../model/hero-copy-engine";
import { interpretWeather } from "../model/weather-interpreter";
import type { ActivityBias, TimeOfDay } from "../model/types";
import { getCityCoordsBySlug, getDefaultBelarusFallbackCoords } from "./belarus-city-coordinates";
import { weatherDiagLog } from "./weather-diag-log";

export type HeroDebugWeatherSource = "mock" | "open-meteo" | "fallback";

export type HeroGreetingModel = {
  microcopy: string;
  title: string;
  subtitle: string;
  emoji: string;
  weatherScenario: string;
  activityBias: ActivityBias;
  timeOfDay: TimeOfDay;
  personaMode: HeroPersonaContext["mode"];
  cityName?: string;
  /** Hint for feed ranking / filters below the hero (not wired yet). */
  preferredContext?: "outdoor" | "indoor" | "mixed" | "caution";
  debug?: {
    scenario: string;
    timeOfDay: string;
    personaMode: string;
    weatherSource: HeroDebugWeatherSource;
    selectedIds?: {
      microcopyId: string;
      titleId: string;
      subtitleId: string;
    };
  };
};

function weatherSourceFromProvider(provider: WeatherProvider): Exclude<HeroDebugWeatherSource, "fallback"> {
  if (provider instanceof OpenMeteoWeatherProvider) return "open-meteo";
  return "mock";
}

function resolveCoordinates(input?: {
  citySlug?: string;
  latitude?: number;
  longitude?: number;
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
}): { lat: number; lon: number; timezone: string } {
  if (
    input?.latitude != null &&
    input?.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    const fromCity = getCityCoordsBySlug(input.citySlug);
    return {
      lat: input.latitude,
      lon: input.longitude,
      timezone: fromCity?.timezone ?? getDefaultBelarusFallbackCoords().timezone,
    };
  }

  const clat = input?.cityCenterLat;
  const clng = input?.cityCenterLng;
  if (clat != null && clng != null && Number.isFinite(clat) && Number.isFinite(clng)) {
    const fromSlug = getCityCoordsBySlug(input?.citySlug);
    return {
      lat: clat,
      lon: clng,
      timezone: fromSlug?.timezone ?? getDefaultBelarusFallbackCoords().timezone,
    };
  }

  const fromSlug = getCityCoordsBySlug(input?.citySlug);
  if (fromSlug) return { lat: fromSlug.lat, lon: fromSlug.lon, timezone: fromSlug.timezone };

  return getDefaultBelarusFallbackCoords();
}

/**
 * Product mapping for feed bias (can diverge slightly from raw activityBias labels).
 */
export function scenarioToPreferredContext(
  scenario: string,
): NonNullable<HeroGreetingModel["preferredContext"]> {
  switch (scenario) {
    case "great_outdoor":
    case "good_outdoor":
      return "outdoor";
    case "rain_indoor":
    case "heavy_rain_indoor":
    case "snow_indoor":
      return "indoor";
    case "windy_caution":
    case "storm_alert":
    case "ice_alert":
    case "hot_caution":
      return "caution";
    case "mixed_outdoor":
    case "cold_mixed":
    case "unknown":
    default:
      return "mixed";
  }
}

export function getFallbackHeroModel(overrides?: Partial<Pick<HeroGreetingModel, "cityName" | "personaMode">>): HeroGreetingModel {
  const personaMode = overrides?.personaMode ?? "guest";
  return {
    microcopy: "✨ Сегодня можно выбрать что-то приятное",
    title: "Давай найдём что-нибудь для семьи",
    subtitle: "Уже собрала варианты, чтобы выбирать было проще",
    emoji: "✨",
    weatherScenario: "unknown",
    activityBias: "mixed",
    timeOfDay: "day",
    personaMode,
    cityName: overrides?.cityName,
    preferredContext: "mixed",
    debug: {
      scenario: "unknown",
      timeOfDay: "day",
      personaMode,
      weatherSource: "fallback",
    },
  };
}

/**
 * Server-safe orchestrator: weather → interpret → copy (+ ids for anti-repeat).
 */
export async function getHeroContext(input?: {
  citySlug?: string;
  cityName?: string;
  /** From Prisma `City.centerLat` / `lat` when available */
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
  latitude?: number;
  longitude?: number;
  userName?: string | null;
  childName?: string | null;
  personaMode?: HeroPersonaContext["mode"];
  timezone?: string;
  /** Tests / overrides; default: `getWeatherProvider()` from env */
  weatherProvider?: WeatherProvider;
}): Promise<HeroGreetingModel> {
  const personaMode = input?.personaMode ?? "guest";
  const cityName = input?.cityName;

  try {
    const provider: WeatherProvider = input?.weatherProvider ?? getWeatherProvider();
    weatherDiagLog(
      "using provider:",
      input?.weatherProvider ? "injected" : "from factory",
      provider.constructor.name,
    );
    const coords = resolveCoordinates(input);
    const tz = input?.timezone ?? coords.timezone;

    weatherDiagLog("calling fetchWeather with:", {
      lat: coords.lat,
      lon: coords.lon,
      citySlug: input?.citySlug,
      timezone: tz,
    });

    const raw = await provider.fetchWeather({
      latitude: coords.lat,
      longitude: coords.lon,
      timezone: tz,
    });

    weatherDiagLog("fetchWeather result:", raw ? "WeatherRawData (ok)" : "null");

    if (!raw) {
      weatherDiagLog("fallback triggered", "reason:", "fetchWeather_returned_null");
      return getFallbackHeroModel({ cityName, personaMode });
    }

    const now = new Date();
    const wx = interpretWeather(raw, now);

    const persona: HeroPersonaContext = {
      mode: personaMode,
      userName: input?.userName ?? null,
      childName: input?.childName ?? null,
    };

    const generated = generateHeroCopyWithSelection({
      weather: {
        scenario: wx.scenario,
        timeOfDay: wx.timeOfDay,
        emoji: wx.emoji,
      },
      persona,
      cityName,
    });

    const src = weatherSourceFromProvider(provider);

    return {
      microcopy: generated.microcopy,
      title: generated.title,
      subtitle: generated.subtitle,
      emoji: wx.emoji,
      weatherScenario: wx.scenario,
      activityBias: wx.activityBias,
      timeOfDay: wx.timeOfDay,
      personaMode: persona.mode,
      cityName,
      preferredContext: scenarioToPreferredContext(wx.scenario),
      debug: {
        scenario: wx.scenario,
        timeOfDay: wx.timeOfDay,
        personaMode: persona.mode,
        weatherSource: src,
        selectedIds: generated.selection,
      },
    };
  } catch (e) {
    weatherDiagLog("fallback triggered", "reason:", "exception", e);
    return getFallbackHeroModel({ cityName, personaMode });
  }
}
