export type WeatherHourSlot = {
  temperature: number | null;
  apparentTemperature: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  isDay: boolean | null;
};

export type WeatherWarning = {
  type: "storm" | "wind" | "ice" | "snow" | "heat";
  severity: "moderate" | "severe";
};

export type WeatherRawData = {
  current: WeatherHourSlot;
  hourly: WeatherHourSlot[];
  warnings?: WeatherWarning[];
};

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

export type ActivityBias = "outdoor" | "indoor" | "mixed" | "caution";

export type TimeOfDay = "morning" | "day" | "evening";

export type HeroWeatherContext = {
  scenario: WeatherScenario;
  activityBias: ActivityBias;
  timeOfDay: TimeOfDay;
  emoji: string;
  hasWarning: boolean;
};
