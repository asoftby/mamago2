import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { OpenMeteoHourlyResponse, DayWeather, TimeOfDayWeather, WeeklyWeatherData } from "./types";

/**
 * Group hourly data by date and time of day
 */
export function transformWeatherData(
  response: OpenMeteoHourlyResponse,
  citySlug: string
): WeeklyWeatherData {
  const { hourly } = response;
  const byDate: Record<string, DayWeather> = {};

  // Group by date
  const hourlyByDate: Record<string, Array<{ hour: number; temp: number; code: number; windspeed: number }>> = {};

  for (let i = 0; i < hourly.time.length; i++) {
    const dateTime = new Date(hourly.time[i]);
    const dateStr = format(dateTime, "yyyy-MM-dd");
    const hour = dateTime.getHours();
    const temp = Math.round(hourly.temperature_2m[i]);
    const code = hourly.weathercode[i];
    const windspeed = Math.round(hourly.windspeed_10m?.[i] ?? 0);

    if (!hourlyByDate[dateStr]) {
      hourlyByDate[dateStr] = [];
    }

    hourlyByDate[dateStr].push({ hour, temp, code, windspeed });
  }

  // Transform each day
  for (const [dateStr, hours] of Object.entries(hourlyByDate)) {
    const date = new Date(dateStr);
    const weekday = format(date, "EEEE", { locale: ru });

    // Morning: 06:00-11:59
    const morningHours = hours.filter((h) => h.hour >= 6 && h.hour < 12);
    const morning = aggregateTimeOfDay(morningHours);

    // Day: 12:00-17:59
    const dayHours = hours.filter((h) => h.hour >= 12 && h.hour < 18);
    const day = aggregateTimeOfDay(dayHours);

    // Evening: 18:00-22:59
    const eveningHours = hours.filter((h) => h.hour >= 18 && h.hour < 23);
    const evening = aggregateTimeOfDay(eveningHours);

    byDate[dateStr] = {
      date: dateStr,
      weekday,
      morning,
      day,
      evening,
    };
  }

  return {
    byDate,
    fetchedAt: new Date().toISOString(),
    citySlug,
  };
}

/**
 * Aggregate weather for a time period
 * Uses max temperature and most frequent weather code
 */
function aggregateTimeOfDay(
  hours: Array<{ hour: number; temp: number; code: number; windspeed: number }>
): TimeOfDayWeather {
  if (hours.length === 0) {
    return { temp: 0, code: 0, windspeed: 0 };
  }

  // Max temperature
  const temp = Math.max(...hours.map((h) => h.temp));

  // Most frequent weather code
  const codeCounts: Record<number, number> = {};
  for (const h of hours) {
    codeCounts[h.code] = (codeCounts[h.code] || 0) + 1;
  }

  const code = Number(
    Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0][0]
  );

  // Max wind speed
  const windspeed = Math.max(...hours.map((h) => h.windspeed));

  return { temp, code, windspeed };
}
