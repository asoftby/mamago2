import type { WeatherRawData } from "../model/types";

export interface WeatherProvider {
  /**
   * Fetch raw weather data for the given coordinates.
   * Returns null if data is unavailable (network error, unsupported location, etc.)
   */
  fetchWeather(params: {
    latitude: number;
    longitude: number;
    /** ISO 8601 timezone string, e.g. "Europe/Minsk" */
    timezone?: string;
  }): Promise<WeatherRawData | null>;
}
