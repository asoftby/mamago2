/**
 * Open-Meteo weather code descriptions
 * https://open-meteo.com/en/docs
 */

export const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "ясно",
  1: "преимущественно ясно",
  2: "переменная облачность",
  3: "облачно",
  45: "туман",
  48: "изморозь",
  51: "лёгкая морось",
  53: "морось",
  55: "сильная морось",
  56: "ледяная морось",
  57: "сильная ледяная морось",
  61: "небольшой дождь",
  63: "дождь",
  65: "сильный дождь",
  66: "ледяной дождь",
  67: "сильный ледяной дождь",
  71: "небольшой снег",
  73: "снег",
  75: "сильный снег",
  77: "снежная крупа",
  80: "небольшой ливень",
  81: "ливень",
  82: "сильный ливень",
  85: "снегопад",
  86: "сильный снегопад",
  95: "гроза",
  96: "гроза с градом",
  99: "гроза с сильным градом",
};

export function getWeatherDescription(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] ?? "неизвестно";
}

/**
 * Determine if weather is suitable for outdoor activities
 */
export function isOutdoorFriendly(code: number): boolean {
  // Clear, partly cloudy, or overcast
  return code >= 0 && code <= 3;
}

/**
 * Determine if weather suggests indoor activities
 */
export function isIndoorRecommended(code: number): boolean {
  // Rain, snow, storms
  return code >= 51 || code === 45 || code === 48;
}
