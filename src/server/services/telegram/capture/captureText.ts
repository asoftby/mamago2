/**
 * Unicode-safe text normalization shared by place matching and plan-duplicate
 * detection: lowercase, ё→е, punctuation removed, whitespace collapsed.
 */
const STOP_WORDS = new Set([
  "а", "без", "в", "во", "для", "до", "за", "и", "из", "или", "к", "ко", "на", "над", "не", "но", "о", "об",
  "от", "по", "под", "при", "про", "с", "со", "у", "the", "a", "an", "of", "at", "to", "in", "on", "and",
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(text: string, options: { dropStopWords?: boolean } = {}): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const tokens = normalized.split(" ");
  return options.dropStopWords ? tokens.filter((token) => !STOP_WORDS.has(token)) : tokens;
}

export function isStopWord(token: string): boolean {
  return STOP_WORDS.has(token);
}
