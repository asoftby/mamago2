/**
 * formatDescriptionText
 *
 * Приводит AI-текст к редакторскому формату:
 *   [сюжет — несколько коротких абзацев]
 *
 *   [мета-строка 1]
 *
 *   [мета-строка 2]
 *   ...
 *
 * Если мета не найдена — возвращает только сюжет.
 */

// ─── Мусор ────────────────────────────────────────────────────────────────────

/** Фрагменты, которые нужно вырезать из текста целиком. */
const JUNK_PATTERNS: RegExp[] = [
  /ВЫБРАТЬ СЕАНС/gi,
  /КУПИТЬ БИЛЕТ(Ы)?/gi,
  /ЗАБРОНИРОВАТЬ/gi,
  /ЗАРЕГИСТРИРОВАТЬСЯ/gi,
  /ПОДРОБНЕЕ/gi,
  /УЗНАТЬ БОЛЬШЕ/gi,
  /СМОТРЕТЬ РАСПИСАНИЕ/gi,
  /РАСПИСАНИЕ СЕАНСОВ/gi,
];

function removeJunk(text: string): string {
  let result = text;
  for (const re of JUNK_PATTERNS) {
    result = result.replace(re, "");
  }
  return result
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Мета-паттерны ────────────────────────────────────────────────────────────

/**
 * Каждый паттерн описывает один тип мета-данных.
 * match(text) — находит фрагмент в тексте.
 * format(raw) — нормализует его в финальную строку.
 */
interface MetaPattern {
  key: string;
  /** Regex для поиска фрагмента в тексте (с захватом значения). */
  regex: RegExp;
  /** Форматирует захваченное значение в финальную строку. */
  format: (match: RegExpMatchArray) => string;
}

const META_PATTERNS: MetaPattern[] = [
  // Страна + год: "Россия, 2026" / "Россия 2026" / "США, 2024"
  {
    key: "country_year",
    regex: /([А-ЯA-Z][а-яa-z]+(?:[,\s]+[А-ЯA-Z][а-яa-z]+)*)[,\s]+(\d{4})\b/,
    format: (m) => `${m[1]!.trim()}, ${m[2]}`,
  },
  // Длительность с меткой: "Длительность: 100 мин" / "Продолжительность: 90 минут"
  {
    key: "duration",
    regex: /(?:Длительность|Продолжительность)\s*:?\s*(\d+\s*мин(?:ут)?)/i,
    format: (m) => `Длительность: ${m[1]!.trim()}`,
  },
  // Просто "100 мин" без метки — применяем ДО режиссёра, чтобы не попасть в его строку
  {
    key: "duration_bare",
    regex: /(?<!\w)(\d+)\s*мин(?:ут)?(?!\w)/i,
    format: (m) => `Длительность: ${m[1]} мин`,
  },
  // Возраст: "6+" / "Возраст: 6+" / "Возрастное ограничение: 6+"
  {
    key: "age",
    regex: /(?:Возраст(?:ное\s+ограничение)?\s*:?\s*)?(\d+)\+/i,
    format: (m) => `Возраст: ${m[1]}+`,
  },
  // Режиссёр(ы) — после удаления длительности и возраста, чтобы не захватить их
  {
    key: "director",
    regex: /Режисс[её]р[ы]?\s*:?\s*((?:(?!Длительность|Продолжительность|\d+\s*мин|\d+\+)[^\n])+)/i,
    format: (m) => `Режиссеры: ${m[1]!.trim().replace(/\s+/g, " ")}`,
  },
];

// ─── Извлечение мета ──────────────────────────────────────────────────────────

interface ExtractResult {
  plot: string;
  meta: string[];
}

const META_BLOCK_PREFIXES = [
  "стоимость",
  "цена",
  "время",
  "когда",
  "дата",
  "адрес",
  "где",
  "билеты",
  "телефон",
  "регистрация",
  "условия",
  "возраст",
  "длительность",
  "продолжительность",
];

function normalizeInlineWhitespace(text: string): string {
  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function normalizeLine(line: string): string {
  const trimmed = normalizeInlineWhitespace(line);
  if (!trimmed) return "";

  if (/^[\-–•*]\s+/.test(trimmed)) {
    return trimmed.replace(/^[\-–•*]\s+/, "— ");
  }

  return trimmed;
}

function isListLine(line: string): boolean {
  return /^—\s+/.test(line.trim());
}

function isMetaBlockHeading(line: string): boolean {
  const normalized = line.trim().replace(/:$/, "").toLowerCase();
  return META_BLOCK_PREFIXES.some((prefix) => normalized === prefix);
}

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+(?:[.!?]+|$)/g);
  return (matches ?? [text])
    .map((sentence) => normalizeInlineWhitespace(sentence))
    .filter(Boolean);
}

function chunkSentences(sentences: string[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    current.push(sentence);

    const currentText = current.join(" ");
    const shouldFlush =
      current.length >= 4 ||
      currentText.length >= 420 ||
      /[!?…]$/.test(sentence);

    if (shouldFlush) {
      chunks.push(currentText);
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

function normalizeBlock(block: string): string {
  const lines = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  if (lines.length === 0) return "";

  const dedupedLines = lines.filter((line, index) => line !== lines[index - 1]);
  if (dedupedLines.length === 0) return "";

  if (dedupedLines.length > 1) {
    return dedupedLines.join("\n");
  }

  const onlyLine = dedupedLines[0]!;
  if (isListLine(onlyLine) || isMetaBlockHeading(onlyLine)) {
    return onlyLine;
  }

  if (onlyLine.length < 650) {
    return onlyLine;
  }

  const sentences = splitIntoSentences(onlyLine);
  if (sentences.length <= 4) {
    return onlyLine;
  }

  return chunkSentences(sentences).join("\n\n");
}

export function normalizeParagraphs(text: string): string[] {
  if (!text.trim()) return [];

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n{2,}/)
    .map((block) => normalizeBlock(block))
    .flatMap((block) => block.split(/\n{2,}/))
    .map((block) => block.trim())
    .filter(Boolean);

  return normalized;
}

function extractMeta(text: string): ExtractResult {
  let remaining = text;
  const meta: string[] = [];
  const foundKeys = new Set<string>();

  for (const pattern of META_PATTERNS) {
    // Пропускаем duration_bare если duration уже найден
    if (pattern.key === "duration_bare" && foundKeys.has("duration")) continue;

    const match = remaining.match(pattern.regex);
    if (!match) continue;

    const formatted = pattern.format(match);
    if (formatted) {
      meta.push(formatted);
      foundKeys.add(pattern.key);
      remaining = remaining
        .replace(match[0], "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
  }

  const plot = normalizeParagraphs(remaining).join("\n\n");

  return { plot, meta };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function formatDescriptionText(input: string): string {
  if (!input || !input.trim()) return "";

  // 1. Убираем мусор
  const cleaned = removeJunk(input);
  if (!cleaned) return "";

  // 2. Извлекаем мета, получаем чистый сюжет
  const { plot, meta } = extractMeta(cleaned);

  if (!plot && meta.length === 0) return "";

  // 3. Собираем результат
  const parts: string[] = [];

  if (plot) parts.push(plot);

  // Каждый мета-элемент — отдельный абзац (разделён \n\n)
  if (meta.length > 0) {
    parts.push(...meta);
  }

  return parts.join("\n\n");
}
