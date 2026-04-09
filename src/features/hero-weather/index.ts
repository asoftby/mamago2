export type {
  WeatherRawData,
  WeatherHourSlot,
  WeatherWarning,
  WeatherScenario,
  ActivityBias,
  TimeOfDay,
  HeroWeatherContext,
} from "./model/types";

export { interpretWeather } from "./model/weather-interpreter";
export type { WeatherProvider } from "./api/weather-provider";
export { MockWeatherProvider } from "./api/mock-weather-provider";
export { OpenMeteoWeatherProvider, mapOpenMeteoToWeatherRawData } from "./api/open-meteo-provider";
export {
  getWeatherProvider,
  getConfiguredWeatherProviderKind,
} from "./api/weather-provider-factory";
export type { WeatherProviderKind } from "./api/weather-provider-factory";

export {
  applyTemplate,
  sanitizeDisplayName,
  generateHeroCopyFromSelection,
  generateHeroCopyWithAntiRepeat,
  generateHeroCopyWithSelection,
} from "./model/hero-copy-engine";

export { generateHeroCopy } from "./model/hero-copy-types";
export type {
  HeroPersonaContext,
  GenerateHeroCopyInput,
  GeneratedHeroCopy,
} from "./model/hero-copy-types";

export {
  loadAntiRepeatState,
  saveAntiRepeatState,
  appendAntiRepeatEntry,
  pruneAntiRepeatState,
  HERO_COPY_HISTORY_STORAGE_KEY,
} from "./model/anti-repeat-store";
export type {
  AntiRepeatState,
  AntiRepeatEntry,
  HeroCopySelectionIds,
  PickCandidate,
  WeatherScenario as HeroAntiRepeatWeatherScenario,
} from "./model/anti-repeat-types";
export { normalizeWeatherScenario } from "./model/anti-repeat-types";
export {
  pickWeightedNonRepeating,
  pickWeightedRandom,
  countRecentMatches,
  getRecentEntriesForScenario,
  selectHeroCopyIdsWithAntiRepeat,
  selectCopyVariantsWithAntiRepeat,
} from "./model/anti-repeat-engine";

export {
  getHeroContext,
  getFallbackHeroModel,
  scenarioToPreferredContext,
} from "./lib/get-hero-context";
export type { HeroGreetingModel, HeroDebugWeatherSource } from "./lib/get-hero-context";

export { fetchJsonWithTimeout } from "./lib/fetch-json-with-timeout";
export {
  getCityCoordsBySlug,
  getDefaultBelarusFallbackCoords,
} from "./lib/belarus-city-coordinates";

export { HeroGreeting } from "./ui/HeroGreeting";
export { HeroGreetingShell } from "./ui/HeroGreetingShell";
export { HeroMoodIcon } from "./ui/HeroMoodIcon";
export type { HeroMoodIconProps } from "./ui/HeroMoodIcon";
