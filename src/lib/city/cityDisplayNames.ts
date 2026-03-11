/**
 * Helper functions for city display names in Russian
 */

// Map city slugs to their display names in prepositional case (в + city)
const CITY_DISPLAY_NAMES: Record<string, string> = {
  minsk: "Минске",
  brest: "Бресте", 
  gomel: "Гомеле",
  grodno: "Гродно",
  mogilev: "Могилёве",
  vitebsk: "Витебске",
};

/**
 * Get city display name in prepositional case (for use with "в")
 * Example: getCityDisplayName("minsk") => "Минске"
 * Usage: "Куда пойти в " + getCityDisplayName("minsk") => "Куда пойти в Минске"
 */
export function getCityDisplayName(citySlug: string): string {
  return CITY_DISPLAY_NAMES[citySlug.toLowerCase()] || citySlug;
}

/**
 * Get formatted title by replacing {city} placeholder with proper city name
 * Example: formatCityTitle("Куда пойти в {city}", "minsk") => "Куда пойти в Минске"
 */
export function formatCityTitle(template: string, citySlug: string): string {
  const cityName = getCityDisplayName(citySlug);
  return template.replace("{city}", cityName);
}