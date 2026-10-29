/**
 * String normalization helpers для place matching.
 * Цель: привести строки к сравнимой форме без NLP.
 */

/** Нормализовать название места для сравнения */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[«»""''„"]/g, "") // кавычки
    .replace(/[-–—]/g, " ")     // дефисы/тире → пробел
    .replace(/[.,!?;:()/\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Нормализовать телефон к цифрам (последние 9 для сравнения) */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Берём последние 9 цифр — достаточно для сравнения в рамках одной страны
  return digits.slice(-9);
}

/** Извлечь домен из URL для сравнения */
export function normalizeWebsiteDomain(raw: string): string | null {
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    const hostname = new URL(url).hostname.toLowerCase();
    // Убрать www.
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// JS `\b` не работает для кириллицы — границы слов задаём явно.
const WORD_BEFORE = "(?<![а-яёa-z0-9])";
const WORD_AFTER = "(?![а-яёa-z0-9])";

const ADDRESS_NOISE = new RegExp(
  `${WORD_BEFORE}(?:пр-кт|пр-т|улица|проспект|переулок|бульвар|площадь|ул|пр|пер|бул|пл|трц|тц)${WORD_AFTER}`,
  "g",
);
const ADDRESS_FLOOR = new RegExp(`${WORD_BEFORE}(?:\\d+\\s*-?\\s*й?\\s*этаж|этаж\\s*\\d+)${WORD_AFTER}`, "g");

/** Нормализовать адрес для сравнения */
export function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(ADDRESS_FLOOR, " ")
    .replace(ADDRESS_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EVENT_TITLE_SERVICE_WORDS = new RegExp(
  `${WORD_BEFORE}(?:спектакль|премьера|мастер[\\s-]?класс|мк|шоу|концерт|квиз)${WORD_AFTER}`,
  "g",
);

/**
 * Название события для сравнения: без эмодзи, возрастных меток («6+»,
 * «(0+)») и служебных слов. Если после чистки ничего не осталось,
 * возвращается обычная нормализация, чтобы «Квиз» не стал пустой строкой.
 */
export function normalizeEventTitle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, " ")
    .replace(/\(?\s*\d{1,2}\s*\+\s*\)?/g, " ")
    .replace(EVENT_TITLE_SERVICE_WORDS, " ");
  const result = normalizeTitle(cleaned);
  return result || normalizeTitle(raw);
}

/**
 * Расстояние между двумя точками в метрах (Haversine).
 */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Простое сходство строк: доля общих токенов (Jaccard на словах).
 * Возвращает [0..1].
 */
export function tokenJaccard(a: string, b: string): number {
  const tokA = new Set(a.split(" ").filter(Boolean));
  const tokB = new Set(b.split(" ").filter(Boolean));
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokA) if (tokB.has(t)) intersection++;
  const union = tokA.size + tokB.size - intersection;
  return intersection / union;
}
