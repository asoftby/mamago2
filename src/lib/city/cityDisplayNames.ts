/**
 * Helper functions for city display names in Russian.
 *
 * Keep this list aligned with the Belarus city slugs supported by
 * `src/server/geo/city-resolver.ts`: any city that can be resolved into
 * a public city slug must have both nominative and prepositional forms.
 */

// Map city slugs to their display names in prepositional case (в + city)
export const CITY_DISPLAY_NAMES: Record<string, string> = {
  minsk: "Минске",
  "marina-gorka": "Марьиной Горке",
  brest: "Бресте",
  gomel: "Гомеле",
  grodno: "Гродно",
  mogilev: "Могилёве",
  vitebsk: "Витебске",
  borisov: "Борисове",
  molodechno: "Молодечно",
  soligorsk: "Солигорске",
  pinsk: "Пинске",
  orsha: "Орше",
  lida: "Лиде",
};

/** Именительный падеж для подзаголовков («Алексей · Минск») */
export const CITY_NOMINATIVE: Record<string, string> = {
  minsk: "Минск",
  "marina-gorka": "Марьина Горка",
  brest: "Брест",
  gomel: "Гомель",
  grodno: "Гродно",
  mogilev: "Могилёв",
  vitebsk: "Витебск",
  borisov: "Борисов",
  molodechno: "Молодечно",
  soligorsk: "Солигорск",
  pinsk: "Пинск",
  orsha: "Орша",
  lida: "Лида",
};

export function getCityNominativeName(citySlug: string): string {
  return CITY_NOMINATIVE[citySlug.toLowerCase()] ?? citySlug;
}

export const KNOWN_CITY_SLUGS = Object.freeze(Object.keys(CITY_NOMINATIVE));

/**
 * Get city display name in prepositional case (for use with "в")
 * Example: getCityDisplayName("minsk") => "Минске"
 * Usage: "Куда пойти в " + getCityDisplayName("minsk") => "Куда пойти в Минске"
 */
export function getCityDisplayName(citySlug: string): string {
  return CITY_DISPLAY_NAMES[citySlug.toLowerCase()] || citySlug;
}

/**
 * Phrase for search bars: «в Минске», «в Бресте», …
 */
export function getCityLocativePhrase(citySlug: string): string {
  const tail = CITY_DISPLAY_NAMES[citySlug.toLowerCase()];
  return tail ? `в ${tail}` : `в ${citySlug}`;
}

/**
 * Get formatted title by replacing {city} placeholder with proper city name
 * Example: formatCityTitle("Куда пойти в {city}", "minsk") => "Куда пойти в Минске"
 */
export function formatCityTitle(template: string, citySlug: string): string {
  const cityName = getCityDisplayName(citySlug);
  return template.replace("{city}", cityName);
}
