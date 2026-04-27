/**
 * Chunking-логика для AI rewrite длинных описаний.
 * Чистые функции без React и API-зависимостей.
 */

const CHUNK_MAX = 3000; // символов на чанк

// Паттерны начала нового события/блока в расписании
// "18 апреля -", "25 апреля —", "9 мая:", "16 мая -" и т.п.
const EVENT_BLOCK_RE =
  /(?=\n(?:\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s*[-—:]))/gi;

/**
 * Разбивает текст на логические чанки.
 *
 * Приоритет:
 * 1. По паттернам дат/событий ("18 апреля -")
 * 2. По двойным переносам (абзацы)
 * 3. По одиночным переносам
 * 4. По предложениям
 *
 * Чанки не превышают CHUNK_MAX символов.
 * Не режет посередине строки с датой/заголовком.
 */
export function splitTextIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= CHUNK_MAX) return [normalized];

  // Пробуем разбить по паттернам дат
  const byEvents = splitByPattern(normalized, EVENT_BLOCK_RE);
  if (byEvents.length > 1) return mergeSmallChunks(byEvents);

  // По двойным переносам (абзацы)
  const byParagraphs = normalized.split(/\n{2,}/).filter(Boolean);
  if (byParagraphs.length > 1) return mergeSmallChunks(byParagraphs);

  // По одиночным переносам
  const byLines = normalized.split(/\n/).filter(Boolean);
  if (byLines.length > 1) return mergeSmallChunks(byLines);

  // По предложениям
  const bySentences = normalized
    .split(/(?<=[.!?])\s+(?=[А-ЯA-Z"«\d])/)
    .filter(Boolean);
  return mergeSmallChunks(bySentences);
}

/** Разбивает текст по regex-паттерну (lookahead). */
function splitByPattern(text: string, re: RegExp): string[] {
  const parts = text.split(re).filter(Boolean);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Склеивает мелкие части в чанки не больше CHUNK_MAX.
 * Не разрезает части посередине.
 */
function mergeSmallChunks(parts: string[]): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const sep = current ? "\n\n" : "";
    const candidate = current + sep + part;

    if (candidate.length > CHUNK_MAX && current) {
      chunks.push(current.trim());
      current = part;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}
