/**
 * City Resolver — единый resolver для определения города из адресных компонентов Google.
 *
 * Правила:
 * - Разрешены только: locality, postal_town
 * - Запрещены: administrative_area_level_*, country, region
 * - Если найден только administrative_area_level_1 (область) — needsReview = true, city = null
 * - Whitelist городов Беларуси для надёжного маппинга
 */

export type CityResolverSource =
  | "locality"
  | "postal_town"
  | "whitelist"
  | "manual"
  | "fallback"
  | "unknown";

export interface CityResolverResult {
  cityName: string | null;
  citySlug: string | null;
  confidence: number; // 0.0 – 1.0
  source: CityResolverSource;
  rejectedCandidates: Array<{
    name: string;
    reason: string;
    componentTypes: string[];
  }>;
  needsReview: boolean;
}

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

// ─── Whitelist городов Беларуси ───────────────────────────────────────────────

/**
 * Канонический маппинг: нормализованное имя → slug.
 * Включает варианты на русском, белорусском и английском.
 */
const BY_CITY_WHITELIST: Record<string, string> = {
  // Минск
  "минск": "minsk",
  "мінск": "minsk",
  "minsk": "minsk",
  // Гродно
  "гродно": "grodno",
  "гродна": "grodno",
  "grodno": "grodno",
  "hrodna": "grodno",
  // Брест
  "брест": "brest",
  "брэст": "brest",
  "brest": "brest",
  // Гомель
  "гомель": "gomel",
  "gomel": "gomel",
  "homel": "gomel",
  // Витебск
  "витебск": "vitebsk",
  "віцебск": "vitebsk",
  "vitebsk": "vitebsk",
  // Могилёв
  "могилёв": "mogilev",
  "магілёў": "mogilev",
  "mogilev": "mogilev",
  "mahilyow": "mogilev",
  // Марьина Горка
  "марьина горка": "marina-gorka",
  "мар'іна горка": "marina-gorka",
  "maryina horka": "marina-gorka",
  // Борисов
  "борисов": "borisov",
  "барысаў": "borisov",
  "barysaw": "borisov",
  // Молодечно
  "молодечно": "molodechno",
  "маладзечна": "molodechno",
  "maladzyechna": "molodechno",
  // Солигорск
  "солигорск": "soligorsk",
  "салігорск": "soligorsk",
  "soligorsk": "soligorsk",
  // Пинск
  "пинск": "pinsk",
  "пінск": "pinsk",
  "pinsk": "pinsk",
  // Орша
  "орша": "orsha",
  "orsha": "orsha",
  // Лида
  "лида": "lida",
  "ліда": "lida",
  "lida": "lida",
};

/**
 * Паттерны, которые указывают на административный регион, а не город.
 * Если имя содержит любой из них — это не город.
 */
const ADMINISTRATIVE_REGION_PATTERNS = [
  /область/i,
  /вобласць/i,
  /region/i,
  /oblast/i,
  /район/i,
  /rayon/i,
  /raion/i,
  /округ/i,
  /okrug/i,
  /country/i,
  /страна/i,
  /краіна/i,
];

/**
 * Типы компонентов Google, которые ЗАПРЕЩЕНЫ как источник города
 * и должны попасть в rejectedCandidates.
 */
const FORBIDDEN_COMPONENT_TYPES = new Set([
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "administrative_area_level_4",
  "administrative_area_level_5",
]);

/**
 * Типы компонентов Google, которые РАЗРЕШЕНЫ как источник города.
 */
const ALLOWED_COMPONENT_TYPES = ["locality", "postal_town"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeForLookup(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isAdministrativeRegionName(name: string): boolean {
  return ADMINISTRATIVE_REGION_PATTERNS.some((pattern) => pattern.test(name));
}

function lookupWhitelist(name: string): string | null {
  return BY_CITY_WHITELIST[normalizeForLookup(name)] ?? null;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Определяет город из массива addressComponents Google Geocoding API.
 *
 * Приоритет:
 * 1. locality → высокая уверенность
 * 2. postal_town → средняя уверенность
 * 3. Всё остальное → rejected
 *
 * Если найден только administrative_area_level_1 — needsReview = true.
 */
export function resolveCityFromComponents(
  addressComponents: AddressComponent[],
  formattedAddress?: string | null,
): CityResolverResult {
  const rejected: CityResolverResult["rejectedCandidates"] = [];

  // ── Шаг 1: Ищем разрешённые типы ──────────────────────────────────────────
  for (const allowedType of ALLOWED_COMPONENT_TYPES) {
    const component = addressComponents.find((c) => c.types.includes(allowedType));
    if (!component) continue;

    const name = component.long_name;
    if (!name) continue;

    // Проверяем, не является ли это административным регионом по имени
    if (isAdministrativeRegionName(name)) {
      rejected.push({
        name,
        reason: `Name matches administrative region pattern despite type "${allowedType}"`,
        componentTypes: component.types,
      });
      continue;
    }

    // Ищем в whitelist
    const slug = lookupWhitelist(name);

    const source: CityResolverSource =
      allowedType === "locality" ? "locality" : "postal_town";

    return {
      cityName: name,
      citySlug: slug,
      confidence: allowedType === "locality" ? 0.95 : 0.8,
      source,
      rejectedCandidates: rejected,
      needsReview: slug === null, // Если нет в whitelist — нужна проверка
    };
  }

  // ── Шаг 2: Проверяем formattedAddress на whitelist-города ─────────────────
  // Только если нет rejected candidates (административных регионов) и
  // сам formattedAddress не выглядит как административный регион
  if (formattedAddress && rejected.length === 0 && !isAdministrativeRegionName(formattedAddress)) {
    const normalizedAddress = normalizeForLookup(formattedAddress);
    for (const [cityName, slug] of Object.entries(BY_CITY_WHITELIST)) {
      if (normalizedAddress.includes(cityName)) {
        // Находим каноническое имя (первый ключ с этим slug с кириллицей)
        const canonicalEntry = Object.entries(BY_CITY_WHITELIST).find(
          ([k, s]) => s === slug && /[а-яё]/i.test(k),
        );
        const canonicalName = canonicalEntry?.[0] ?? cityName;

        return {
          cityName: canonicalName,
          citySlug: slug,
          confidence: 0.75,
          source: "whitelist",
          rejectedCandidates: rejected,
          needsReview: false,
        };
      }
    }
  }

  // ── Шаг 3: Собираем rejected из запрещённых типов ─────────────────────────
  for (const component of addressComponents) {
    const forbiddenType = component.types.find((t) => FORBIDDEN_COMPONENT_TYPES.has(t));
    if (forbiddenType) {
      rejected.push({
        name: component.long_name,
        reason: `Component type "${forbiddenType}" is not allowed as city source`,
        componentTypes: component.types,
      });
    }
  }

  // ── Шаг 4: Нет города — needsReview ───────────────────────────────────────
  const hasOnlyAdminArea = addressComponents.some((c) =>
    c.types.includes("administrative_area_level_1"),
  );

  return {
    cityName: null,
    citySlug: null,
    confidence: 0,
    source: "unknown",
    rejectedCandidates: rejected,
    needsReview: hasOnlyAdminArea || rejected.length > 0,
  };
}

/**
 * Быстрая проверка: является ли имя допустимым городом (не областью/регионом).
 */
export function isCityNameAllowed(name: string): boolean {
  if (!name) return false;
  if (isAdministrativeRegionName(name)) return false;
  return true;
}

/**
 * Проверяет, можно ли автоматически создать City с данным именем.
 * Используется в import/geocoding pipeline.
 */
export function canAutoCreateCity(result: CityResolverResult): boolean {
  return (
    result.citySlug !== null &&
    result.confidence >= 0.85 &&
    !result.needsReview &&
    (result.source === "locality" || result.source === "postal_town" || result.source === "whitelist") &&
    isCityNameAllowed(result.cityName ?? "")
  );
}
