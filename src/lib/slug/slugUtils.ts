/**
 * Slug utilities for Place
 * Generates human-readable, SEO-friendly URLs with stable slug logic
 */

/**
 * Transliteration map: Cyrillic → Latin
 * Based on BGN/PCGN romanization for Russian/Belarusian
 */
const TRANSLIT_MAP: Record<string, string> = {
  // Russian/Belarusian lowercase
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  
  // Belarusian specific
  ў: "u", і: "i",
  
  // Russian/Belarusian uppercase
  А: "a", Б: "b", В: "v", Г: "g", Д: "d", Е: "e", Ё: "yo", Ж: "zh",
  З: "z", И: "i", Й: "y", К: "k", Л: "l", М: "m", Н: "n", О: "o",
  П: "p", Р: "r", С: "s", Т: "t", У: "u", Ф: "f", Х: "kh", Ц: "ts",
  Ч: "ch", Ш: "sh", Щ: "shch", Ъ: "", Ы: "y", Ь: "", Э: "e", Ю: "yu", Я: "ya",
  
  // Belarusian uppercase
  Ў: "u", І: "i",
};

/**
 * Transliterate Cyrillic text to Latin
 * @example translit("Пуговка") => "pugovka"
 * @example translit("Ратомская") => "ratomskaya"
 */
export function translit(text: string): string {
  return text
    .split("")
    .map((char) => TRANSLIT_MAP[char] || char)
    .join("");
}

/**
 * Normalize place name for duplicate detection
 * Removes extra spaces, converts to lowercase, trims
 * @example normalizePlaceName("  ПУГОВКА  ") => "пуговка"
 * @example normalizePlaceName("Пуговка") => "пуговка"
 */
export function normalizePlaceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " "); // Replace multiple spaces with single space
}

/**
 * Convert text to URL-safe slug
 * - Transliterates Cyrillic to Latin
 * - Converts to lowercase
 * - Replaces spaces and special chars with hyphens
 * - Removes consecutive hyphens
 * - Trims hyphens from start/end
 * 
 * @example slugify("Пуговка") => "pugovka"
 * @example slugify("Ратомская, 7") => "ratomskaya-7"
 * @example slugify("Café & Bar") => "cafe-bar"
 */
export function slugify(text: string): string {
  return translit(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphen
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Trim hyphens from start/end
}

/**
 * Extract street name from address (without house number)
 * Handles various formats:
 * - "ул. Восточная, 129" => "Восточная"
 * - "Притыцкого, 10" => "Притыцкого"
 * - "улица Ратомская, д. 7" => "Ратомская"
 */
export function extractStreetName(address: string): string | null {
  if (!address) return null;
  
  // Remove common prefixes
  let cleaned = address
    .replace(/^(ул\.|улица|пр\.|проспект|пер\.|переулок|пл\.|площадь|вул\.|вулиця)\s*/i, "")
    .trim();
  
  // Take everything before comma or number
  const match = cleaned.match(/^([^,\d]+)/);
  return match ? match[1].trim() : null;
}

/**
 * Get genitive form of street name for "na" construction
 * Восточная -> vostochnoy
 * Притыцкого -> pritytskogo (already in genitive)
 * 
 * Simple heuristic for Russian/Belarusian feminine street names
 */
export function getStreetGenitive(streetName: string): string {
  const slug = slugify(streetName);
  
  // If ends with 'a', replace with 'oy' (Восточная -> vostochnoy)
  if (slug.endsWith('a')) {
    return slug.slice(0, -1) + 'oy';
  }
  
  // If ends with 'ya', replace with 'yey' (Синяя -> sineyey)
  if (slug.endsWith('ya')) {
    return slug.slice(0, -2) + 'yey';
  }
  
  // Otherwise return as-is (likely already in genitive or masculine)
  return slug;
}

/**
 * Parse address to extract street
 */
export function parseAddress(
  formattedAddr?: string | null,
  customAddress?: string | null,
  shortAddress?: string | null
): { street: string | null } {
  const address = shortAddress || formattedAddr || customAddress || "";
  const street = extractStreetName(address);
  return { street };
}

/**
 * Build base slug from place name only
 * Used when place name is unique in the city
 * @example buildBasePlaceSlug({ title: "Пуговка" }) => "pugovka"
 */
export function buildBasePlaceSlug(place: { title: string }): string {
  return slugify(place.title);
}

/**
 * Build address-based slug with street in genitive form
 * Used when there are duplicates with the same name in the city
 * Format: {name}-na-{street-genitive}
 * 
 * @example buildAddressPlaceSlug({ title: "Пуговка", formattedAddr: "Восточная, 129" })
 *   => "pugovka-na-vostochnoy"
 * @example buildAddressPlaceSlug({ title: "Пуговка", formattedAddr: "Притыцкого, 10" })
 *   => "pugovka-na-pritytskogo"
 */
export function buildAddressPlaceSlug(place: {
  title: string;
  formattedAddr?: string | null;
  customAddress?: string | null;
  shortAddress?: string | null;
}): string {
  const baseName = slugify(place.title);
  const { street } = parseAddress(
    place.formattedAddr,
    place.customAddress,
    place.shortAddress
  );

  if (street) {
    const streetGenitive = getStreetGenitive(street);
    return `${baseName}-na-${streetGenitive}`;
  }

  // Fallback to base name if no street available
  return baseName;
}

/**
 * Add numeric suffix to slug
 * Used as last resort when all other strategies fail
 * @example addNumericSuffix("pugovka", 2) => "pugovka-2"
 */
export function addNumericSuffix(slug: string, suffix: number): string {
  return `${slug}-${suffix}`;
}

/**
 * Get display street label for UI (not for slug)
 * Example: "ул. Восточная, 129" -> "Восточная"
 */
export function getStreetLabel(
  formattedAddr?: string | null,
  customAddress?: string | null,
  shortAddress?: string | null
): string | null {
  const { street } = parseAddress(formattedAddr, customAddress, shortAddress);
  return street;
}

/**
 * Get street name in prepositional case for "на" construction (for display)
 * Used in UI: "Пуговка на Ратомской"
 * 
 * Simple heuristic for Russian/Belarusian street names:
 * - Feminine ending 'ая' -> 'ой' (Восточная -> Восточной, Ратомская -> Ратомской)
 * - Feminine ending 'яя' -> 'ей' (Синяя -> Синей)
 * - Genitive masculine (ending 'ого') -> keep as is (Притыцкого -> Притыцкого)
 * - Ending 'а' (not 'ая') -> 'ы' (Ленина -> Ленина, but this is rare)
 * - Other -> keep as is
 */
export function getStreetPrepositional(streetName: string): string {
  const trimmed = streetName.trim();
  
  // If ends with 'ая', replace with 'ой' (Восточная -> Восточной)
  if (trimmed.endsWith('ая')) {
    return trimmed.slice(0, -2) + 'ой';
  }
  
  // If ends with 'яя', replace with 'ей' (Синяя -> Синей)
  if (trimmed.endsWith('яя')) {
    return trimmed.slice(0, -2) + 'ей';
  }
  
  // Otherwise return as-is (likely already in genitive or masculine)
  // Examples: Притыцкого, Ленина, etc.
  return trimmed;
}

/**
 * Get street label in prepositional case for display
 * Combines extraction and case conversion
 * Example: "ул. Восточная, 129" -> "Восточной"
 */
export function getStreetLabelPrepositional(
  formattedAddr?: string | null,
  customAddress?: string | null,
  shortAddress?: string | null
): string | null {
  const street = getStreetLabel(formattedAddr, customAddress, shortAddress);
  if (!street) return null;
  return getStreetPrepositional(street);
}
