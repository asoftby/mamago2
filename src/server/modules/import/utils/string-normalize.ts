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

/** Нормализовать адрес для сравнения */
export function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(ул|улица|пр|проспект|пер|переулок|бул|бульвар|пл|площадь|пр-т|пр-кт)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
