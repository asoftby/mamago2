/**
 * Weather types for My Plan calendar
 */

export type WeatherCode = number;

export interface TimeOfDayWeather {
  /** Average or max temperature for this time period */
  temp: number;
  /** Open-Meteo weather code */
  code: WeatherCode;
}

export interface DayWeather {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Day of week in Russian */
  weekday: string;
  /** Morning weather (06:00-11:59) */
  morning: TimeOfDayWeather;
  /** Day weather (12:00-17:59) */
  day: TimeOfDayWeather;
  /** Evening weather (18:00-22:59) */
  evening: TimeOfDayWeather;
}

export interface WeeklyWeatherData {
  /** Weather by date (YYYY-MM-DD) */
  byDate: Record<string, DayWeather>;
  /** When this data was fetched */
  fetchedAt: string;
  /** City slug this data is for */
  citySlug: string;
}

export interface OpenMeteoHourlyResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
  };
}
