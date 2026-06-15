export type WeatherOutdoorScore =
  | "GOOD_FOR_OUTDOOR"
  | "MIXED"
  | "BAD_FOR_OUTDOOR";

export type WeatherSnapshot = {
  cityId?: string;
  citySlug: string;
  cityName: string;
  provider: "open-meteo";
  currentTemp: number | null;
  currentFeelsLike: number | null;
  currentCondition: string | null;
  dailyMinTemp: number | null;
  dailyMaxTemp: number | null;
  dailyCondition: string | null;
  precipitationProbability: number | null;
  windSpeed: number | null;
  outdoorScore: WeatherOutdoorScore | null;
  updatedAt: string;
};
