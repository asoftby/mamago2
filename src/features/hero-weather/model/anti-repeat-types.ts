/**
 * Weather scenarios for anti-repeat history (superset of copy pools — includes alerts).
 */
export type WeatherScenario =
  | "great_outdoor"
  | "good_outdoor"
  | "mixed_outdoor"
  | "rain_indoor"
  | "heavy_rain_indoor"
  | "windy_caution"
  | "cold_mixed"
  | "snow_indoor"
  | "storm_alert"
  | "ice_alert"
  | "hot_caution"
  | "unknown";

export type HeroCopySelectionIds = {
  microcopyId: string;
  titleId: string;
};

export type AntiRepeatEntry = {
  timestamp: number;
  scenario: WeatherScenario;
  microcopyId: string;
  titleId: string;
};

export type AntiRepeatState = {
  version: 1;
  entries: AntiRepeatEntry[];
};

export type PickCandidate = {
  id: string;
  weight?: number;
};

const SCENARIO_SET = new Set<string>([
  "great_outdoor",
  "good_outdoor",
  "mixed_outdoor",
  "rain_indoor",
  "heavy_rain_indoor",
  "windy_caution",
  "cold_mixed",
  "snow_indoor",
  "storm_alert",
  "ice_alert",
  "hot_caution",
  "unknown",
]);

/** Maps interpreter / API strings to a known scenario for history keys; unknown otherwise. */
export function normalizeWeatherScenario(raw: string): WeatherScenario {
  if (raw != null && SCENARIO_SET.has(raw)) return raw as WeatherScenario;
  return "unknown";
}
