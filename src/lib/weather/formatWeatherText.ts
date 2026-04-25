import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import type { DayWeather } from "./types";
import { getWeatherDescription } from "./weatherCodes";

export type TimeOfDay = "morning" | "day" | "evening";

/**
 * Format weather text for My Plan UI
 * Returns null if date is >7 days from now
 */
export function formatWeatherText(
  date: Date,
  weather: DayWeather | null,
  timeOfDay: TimeOfDay = "evening",
  cityName?: string | null,
): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const daysFromNow = differenceInDays(targetDate, today);

  if (daysFromNow > 7) return null;
  if (!weather) return null;

  const weatherData = weather[timeOfDay];
  const temp = weatherData.temp > 0 ? `+${weatherData.temp}` : `${weatherData.temp}`;
  const description = getWeatherDescription(weatherData.code);

  // "Сегодня" / "Завтра" / "В субботу"
  let datePrefix: string;
  if (isToday(date)) {
    datePrefix = "Сегодня";
  } else if (isTomorrow(date)) {
    datePrefix = "Завтра";
  } else {
    const weekday = format(date, "EEEE", { locale: ru });
    datePrefix = `В ${weekday}`;
  }

  // "в Минске" / "в Гомеле" — only if cityName provided
  const cityPart = cityName ? ` в ${cityName}` : "";

  // "утром" / "днём" / "к вечеру"
  let timeText: string;
  if (timeOfDay === "morning") {
    timeText = "утром";
  } else if (timeOfDay === "day") {
    timeText = "днём";
  } else {
    timeText = "к вечеру";
  }

  return `${datePrefix}${cityPart} ${timeText} ${description}, до ${temp}°`;
}

/**
 * Format date without weather (for dates >7 days)
 */
export function formatDateOnly(date: Date): string {
  if (isToday(date)) {
    return format(date, "Сегодня, d MMMM", { locale: ru });
  }

  if (isTomorrow(date)) {
    return format(date, "Завтра, d MMMM", { locale: ru });
  }

  const weekday = format(date, "EEEE", { locale: ru });
  const dateStr = format(date, "d MMMM", { locale: ru });

  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dateStr}`;
}
