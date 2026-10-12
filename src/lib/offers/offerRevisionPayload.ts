import {
  CAMP_SESSION_OPERATIONAL_KEYS,
  labelForContentColumn,
  offerValuesEqual,
} from "./offerPublishedEditGate";

/**
 * Предлагаемые значения ревизии по колонкам `Offer` + псевдоколонки, которые не лежат в одной колонке:
 * - `requestedPlacements` — ключи размещений;
 * - `categoryIds` — категории предложения;
 * - `campSessionTexts` — смены лагеря целиком (из них применяются только тексты).
 */
export type OfferRevisionPayload = Record<string, unknown>;

export const REVISION_PSEUDO_COLUMNS = ["requestedPlacements", "categoryIds", "campSessionTexts"] as const;

/** Колонки, которые ревизия не переносит никогда (служебные и статус публикации). */
const REVISION_NEVER_COLUMNS: ReadonlySet<string> = new Set(["status", "publishedAt", "updatedAt", "currency"]);

export function isRevisionPseudoColumn(column: string): boolean {
  return (REVISION_PSEUDO_COLUMNS as readonly string[]).includes(column);
}

/** JSON-представление значения для хранения в ревизии: sentinel Prisma (DbNull) → null. */
export function toRevisionJsonValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value !== null && typeof value === "object") {
    const name = (value as { constructor?: { name?: string } }).constructor?.name;
    if (name === "DbNull" || name === "JsonNull" || name === "AnyNull") return null;
  }
  return JSON.parse(JSON.stringify(value ?? null));
}

/**
 * Собрать предложение ревизии из отброшенных контентных колонок.
 * `values` — значения колонок/псевдоколонок, которые партнёр хотел записать.
 */
export function buildRevisionProposal(
  contentColumns: readonly string[],
  values: Record<string, unknown>,
): OfferRevisionPayload {
  const payload: OfferRevisionPayload = {};
  for (const column of contentColumns) {
    if (REVISION_NEVER_COLUMNS.has(column)) continue;
    if (!(column in values)) continue;
    payload[column] = toRevisionJsonValue(values[column]);
  }
  return payload;
}

/** Новая правка поверх ожидающей ревизии: по каждой колонке побеждает последнее значение. */
export function mergeRevisionPayload(
  existing: OfferRevisionPayload | null | undefined,
  proposed: OfferRevisionPayload,
): OfferRevisionPayload {
  return { ...(existing ?? {}), ...proposed };
}

/**
 * Пересчитать ревизию по новому запросу. Мастер шлёт полный снимок формы, поэтому колонки, которые были
 * в запросе (`presentColumns`), оцениваются заново: прежнее предложение по ним заменяется новым (или уходит,
 * если автор вернул живое значение). Колонки, которых в запросе не было, остаются как были.
 */
export function replaceRevisionColumns(
  existing: OfferRevisionPayload | null | undefined,
  presentColumns: readonly string[],
  proposal: OfferRevisionPayload,
): OfferRevisionPayload {
  const present = new Set(presentColumns);
  const retained = Object.fromEntries(
    Object.entries(existing ?? {}).filter(([column]) => !present.has(column)),
  );
  return { ...retained, ...proposal };
}

/**
 * Убрать из ревизии колонки, значение которых уже совпало с живым (например, партнёр вернул прежний текст,
 * или модератор успел применить то же самое). Возвращает сжатое предложение.
 */
export function pruneRevisionPayload(
  payload: OfferRevisionPayload,
  live: Record<string, unknown>,
): OfferRevisionPayload {
  const pruned: OfferRevisionPayload = {};
  for (const [column, value] of Object.entries(payload)) {
    if (isRevisionPseudoColumn(column)) {
      pruned[column] = value;
      continue;
    }
    if (!offerValuesEqual(value, live[column])) pruned[column] = value;
  }
  return pruned;
}

type SessionEntry = Record<string, unknown>;

function asSessions(value: unknown): SessionEntry[] {
  return Array.isArray(value)
    ? value.filter((item): item is SessionEntry => item !== null && typeof item === "object")
    : [];
}

/**
 * Применить тексты смен из ревизии к живым сменам: сопоставление по `id` (без `id` — по позиции),
 * переносятся только неоперационные поля (название, описание, акция, возраст…). Даты, время, места
 * и цена остаются живыми — их партнёр правит напрямую, поэтому ревизия их не перетирает.
 */
export function applyCampSessionTexts(live: unknown, proposed: unknown): SessionEntry[] {
  const liveList = asSessions(live);
  const proposedList = asSessions(proposed);
  const proposedById = new Map(
    proposedList.filter((item) => typeof item.id === "string").map((item) => [item.id as string, item]),
  );

  return liveList.map((session, index) => {
    const source =
      typeof session.id === "string" && proposedById.has(session.id)
        ? proposedById.get(session.id)!
        : proposedList.find((item, i) => typeof item.id !== "string" && i === index);
    if (!source) return session;
    const next: SessionEntry = { ...session };
    for (const [key, value] of Object.entries(source)) {
      if (!CAMP_SESSION_OPERATIONAL_KEYS.has(key)) next[key] = value;
    }
    return next;
  });
}

export type OfferRevisionDiffRow = {
  column: string;
  label: string;
  before: unknown;
  after: unknown;
};

/** Строки для экрана модерации: что было в живой версии и что предлагает партнёр. */
export function buildRevisionDiffRows(
  payload: OfferRevisionPayload,
  live: Record<string, unknown>,
  liveExtras: Record<string, unknown> = {},
): OfferRevisionDiffRow[] {
  return Object.entries(payload).map(([column, after]) => ({
    column,
    label: labelForContentColumn(column),
    before: isRevisionPseudoColumn(column) ? (liveExtras[column] ?? null) : (live[column] ?? null),
    after,
  }));
}

/**
 * Оффер глазами автора: живая строка + его ожидающие правки. Нужен редактору партнёра, чтобы он видел
 * свои предложенные значения, а не «откатившееся» живое. Модератору/админу это не применяют.
 */
export function applyRevisionToOffer<T extends Record<string, unknown>>(
  offer: T,
  payload: OfferRevisionPayload | null | undefined,
): T {
  if (!payload) return offer;
  const next: Record<string, unknown> = { ...offer };

  for (const [column, value] of Object.entries(payload)) {
    if (!isRevisionPseudoColumn(column)) next[column] = value;
  }

  if ("requestedPlacements" in payload && Array.isArray(payload.requestedPlacements)) {
    const live = Array.isArray(offer.placements)
      ? (offer.placements as Array<{ key: string; status?: string | null }>)
      : [];
    const keys = payload.requestedPlacements as string[];
    next.placements = keys.map((key) => live.find((placement) => placement.key === key) ?? { key, status: "REQUESTED" });
  }

  if ("campSessionTexts" in payload) {
    next.campSessions = applyCampSessionTexts(offer.campSessions, payload.campSessionTexts);
  }

  return next as T;
}
