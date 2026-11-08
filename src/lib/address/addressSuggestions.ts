/**
 * Чистая логика подсказок адреса (без Google SDK и React): разбор подсветки,
 * маппинг ответа Places API (New), навигация по списку. Покрыта тестами без ключа Google.
 */

export const ADDRESS_SUGGEST_MIN_CHARS = 2;
export const ADDRESS_SUGGEST_DEBOUNCE_MS = 250;
export const ADDRESS_SUGGEST_MAX_ITEMS = 6;

export type SuggestionRange = { startOffset?: number | null; endOffset?: number | null };

export type HighlightSegment = { text: string; match: boolean };

/** Делит строку на сегменты «совпало / не совпало» по диапазонам Google (StringRange). */
export function splitHighlight(text: string, ranges: readonly SuggestionRange[] | null | undefined): HighlightSegment[] {
  if (!text) return [];
  const normalized = (ranges ?? [])
    .map((range) => ({
      start: Math.max(0, Math.min(text.length, range.startOffset ?? 0)),
      end: Math.max(0, Math.min(text.length, range.endOffset ?? 0)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const range of normalized) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), match: false });
    segments.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}

type RawFormattable = { text?: string | null; matches?: readonly SuggestionRange[] | null } | null | undefined;

/** Минимальная форма placePrediction из Places API (New), нужная UI. */
export type RawPlacePrediction = {
  placeId?: string | null;
  text?: RawFormattable;
  mainText?: RawFormattable;
  secondaryText?: RawFormattable;
};

export type AddressSuggestionView = {
  id: string;
  mainText: string;
  secondaryText: string;
  mainSegments: HighlightSegment[];
};

/** Приводит ответ Google к виду для списка: без дублей и без элементов без placeId. */
export function mapSuggestions(
  predictions: ReadonlyArray<RawPlacePrediction | null | undefined>,
  limit: number = ADDRESS_SUGGEST_MAX_ITEMS,
): AddressSuggestionView[] {
  const seen = new Set<string>();
  const result: AddressSuggestionView[] = [];
  for (const prediction of predictions) {
    const id = prediction?.placeId?.trim();
    if (!prediction || !id || seen.has(id)) continue;
    const mainText = prediction.mainText?.text?.trim() || prediction.text?.text?.trim() || "";
    if (!mainText) continue;
    seen.add(id);
    const usesMainMatches = Boolean(prediction.mainText?.text?.trim());
    result.push({
      id,
      mainText,
      secondaryText: prediction.secondaryText?.text?.trim() ?? "",
      mainSegments: splitHighlight(mainText, usesMainMatches ? prediction.mainText?.matches : prediction.text?.matches),
    });
    if (result.length >= limit) break;
  }
  return result;
}

/** Можно ли отправлять запрос: достаточно символов после trim. */
export function shouldQuerySuggestions(input: string): boolean {
  return input.trim().length >= ADDRESS_SUGGEST_MIN_CHARS;
}

/** Следующий активный индекс при стрелках; -1 — ничего не выбрано. Цикличный. */
export function moveActiveIndex(current: number, direction: "down" | "up", count: number): number {
  if (count <= 0) return -1;
  if (direction === "down") return current < 0 || current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}

/** Сохраняет введённый текст при эхо от родителя: пробелы по краям не считаются изменением. */
export function shouldAdoptExternalValue(external: string | undefined | null, current: string): boolean {
  return (external ?? "").trim() !== current.trim();
}

/** Нижняя граница высоты прокручиваемого списка подсказок, px (≈ 2,5 строки). */
export const SUGGEST_LIST_MIN_HEIGHT = 132;
/** Верхняя граница, px (как max-h-64). */
export const SUGGEST_LIST_MAX_HEIGHT = 256;
/** Высота футера с атрибуцией Google + отступ от края видимой области, px. */
const SUGGEST_LIST_CHROME = 36;

/**
 * Высота списка так, чтобы он помещался между полем и низом ВИДИМОЙ области
 * (с открытой мобильной клавиатурой visualViewport заметно ниже окна).
 * Если места меньше минимума, возвращает минимум: остаток решает прокрутка страницы.
 */
export function computeSuggestListMaxHeight(input: { visibleBottom: number; panelTop: number }): number {
  const available = Math.floor(input.visibleBottom - input.panelTop - SUGGEST_LIST_CHROME);
  if (!Number.isFinite(available)) return SUGGEST_LIST_MAX_HEIGHT;
  return Math.max(SUGGEST_LIST_MIN_HEIGHT, Math.min(SUGGEST_LIST_MAX_HEIGHT, available));
}
