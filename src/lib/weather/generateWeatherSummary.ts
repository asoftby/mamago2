/**
 * Generate a friendly weather summary for a date range
 * Used in "My Plan" for range labels like "На выходных"
 */

export interface WeatherSummaryDay {
  date: string;       // YYYY-MM-DD
  dayOfWeek: string;  // "суббота", "воскресенье", etc.
  tempMax: number;
  tempMin: number;
  condition: "clear" | "partly_cloudy" | "cloudy" | "rain" | "snow";
}

/**
 * Map Open-Meteo weather code to simplified condition
 */
export function codeToCondition(code: number): WeatherSummaryDay["condition"] {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly_cloudy";
  if (code === 3 || code === 45 || code === 48) return "cloudy";
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  // rain, drizzle, showers, storms
  return "rain";
}

/**
 * Aggregate conditions across multiple days
 */
function aggregateCondition(days: WeatherSummaryDay[]): string {
  const conditions = days.map((d) => d.condition);

  // Rain takes priority
  if (conditions.includes("rain")) return "дождливо";
  if (conditions.includes("snow")) return "снежно";

  const unique = new Set(conditions);

  if (unique.size === 1) {
    const c = conditions[0];
    if (c === "clear") return "солнечно";
    if (c === "partly_cloudy") return "переменная облачность";
    if (c === "cloudy") return "облачно";
  }

  // Mixed
  if (conditions.every((c) => c === "clear" || c === "partly_cloudy")) {
    return "переменная облачность";
  }

  return "переменная облачность";
}

/**
 * Interpret temperature into a human-friendly word
 */
function tempLabel(temp: number): string {
  if (temp >= 18) return "тепло";
  if (temp >= 10) return "прохладно";
  return "холодно";
}

/**
 * Format temperature as "+12°" or "-3°"
 */
function formatTemp(temp: number): string {
  return temp > 0 ? `+${temp}°` : `${temp}°`;
}

/**
 * Generate a one-line weather summary for a date range.
 *
 * @param days     Array of 2–7 days with weather data
 * @param city     City name in prepositional case, e.g. "Минске"
 * @param rangeLabel  e.g. "На выходных" | "С 25 по 27 апреля"
 * @returns        Summary string or null if no data
 *
 * @example
 * generateWeatherSummary(days, "Минске", "На выходных")
 * // → "На выходных в Минске прохладно и облачно, до +12°, в воскресенье до +5°"
 */
export function generateWeatherSummary(
  days: WeatherSummaryDay[],
  city: string,
  rangeLabel: string
): string | null {
  if (!days || days.length === 0) return null;

  const maxTemp = Math.max(...days.map((d) => d.tempMax));
  const conditionText = aggregateCondition(days);
  const tempText = tempLabel(maxTemp);

  // Base: "На выходных в Минске прохладно и облачно, до +12°"
  let summary = `${rangeLabel} в ${city} ${tempText} и ${conditionText}, до ${formatTemp(maxTemp)}`;

  // Add notable drop: if any day is >=5° colder than max
  const DROP_THRESHOLD = 5;
  const coldDay = days.find((d) => maxTemp - d.tempMax >= DROP_THRESHOLD);

  if (coldDay) {
    summary += `, в ${coldDay.dayOfWeek} до ${formatTemp(coldDay.tempMax)}`;
  }

  return summary;
}
