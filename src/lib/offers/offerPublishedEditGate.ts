import type { OfferStatus, Role } from "@prisma/client";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";

export const OFFER_PUBLISHED_REQUIRES_MODERATION_CODE =
  "OFFER_PUBLISHED_REQUIRES_MODERATION";

/**
 * Модерация опубликованного оффера — по полям (решение 2 фазы 0).
 *
 * - Контент (название, описание, фото/видео, категории, интересы, FAQ, внешние URL и прочий
 *   текст карточки) — только через модерацию: живая версия не меняется напрямую.
 * - Операционные данные (цены и тарифы, смены, телефоны, способ записи) — применяются сразу
 *   и пишутся в журнал изменений.
 * - Служебные поля (прогресс мастера и т.п.) — не меняют ни публичную карточку, ни операционку.
 *
 * Классификация — по колонкам `Offer`. Неизвестная колонка считается контентом: новое поле
 * по умолчанию не обходит модерацию.
 */
export const OFFER_OPERATIONAL_COLUMNS: ReadonlySet<string> = new Set([
  // цены и тарифы
  "priceFrom",
  "priceTo",
  "priceMode",
  "priceItems",
  // `priceText` — производный от чисел («от N BYN») — операционный только в этой форме; произвольная
  // подпись (из `priceCaption`) — контент: роут переименовывает такое изменение в `priceTextDerived`.
  "priceTextDerived",
  // `priceCaption` — rich-text («что входит», условия) → контент, модерируется.
  // смены (даты, цена, места)
  "campSessions",
  // телефоны и способ связи
  "contactSource",
  // Номера — операционные; подписи к ним (`contactPhone*Label`) — произвольный текст → контент.
  "contactPhone",
  "contactPhone2",
  "contactPhone3",
  // предоплата, отмена, зона выезда (колонки появятся с шагом «Условия»)
  "prepaymentTerms",
  "cancellationTerms",
  "serviceAreaText",
]);

export const OFFER_SERVICE_COLUMNS: ReadonlySet<string> = new Set([
  "wizardCompletedSteps",
  "currency",
  "updatedAt",
]);

export type OfferColumnKind = "operational" | "service" | "content";

export function classifyOfferColumn(column: string): OfferColumnKind {
  if (OFFER_OPERATIONAL_COLUMNS.has(column)) return "operational";
  if (OFFER_SERVICE_COLUMNS.has(column)) return "service";
  return "content";
}

/** Prisma `DbNull`/`JsonNull` и пустые значения сравниваем как «нет значения». */
function normalizeForCompare(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
    // Sentinel-объекты Prisma (DbNull / JsonNull / AnyNull) → null.
    if (ctor === "DbNull" || ctor === "JsonNull" || ctor === "AnyNull") return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
      return (value as { toNumber: () => number }).toNumber();
    }
  }
  return value;
}

export function offerValuesEqual(a: unknown, b: unknown): boolean {
  return stableJsonStringify(normalizeForCompare(a)) === stableJsonStringify(normalizeForCompare(b));
}

/** Колонки из `updateData`, значение которых реально отличается от живой строки. */
export function collectChangedOfferColumns(
  updateData: Record<string, unknown>,
  live: Record<string, unknown>,
): string[] {
  return Object.keys(updateData).filter((column) => !offerValuesEqual(updateData[column], live[column]));
}

export type PublishedOfferEditDecision = {
  /** Контентные изменения требуют модерации — прямая запись запрещена. */
  blocked: boolean;
  contentColumns: string[];
  /** Операционные изменения: применяются сразу и попадают в журнал. */
  operationalColumns: string[];
};

export function decidePublishedOfferEdit(params: {
  role: Role;
  currentStatus: OfferStatus;
  changedColumns: readonly string[];
}): PublishedOfferEditDecision {
  const contentColumns: string[] = [];
  const operationalColumns: string[] = [];

  const needsGate = params.currentStatus === "PUBLISHED" && !canPublishContentDirectly(params.role);
  if (!needsGate) {
    return { blocked: false, contentColumns, operationalColumns };
  }

  for (const column of params.changedColumns) {
    const kind = classifyOfferColumn(column);
    if (kind === "content") contentColumns.push(column);
    else if (kind === "operational") operationalColumns.push(column);
  }

  return { blocked: contentColumns.length > 0, contentColumns, operationalColumns };
}

/**
 * Совместимый вход: PUBLISHED-оффер нельзя править напрямую не-админу.
 * Без `changedColumns` блокируется любая правка (прежнее поведение); с ним — только контентная.
 * ADMIN/MODERATOR (canPublishContentDirectly) правят живую строку сразу.
 */
export function shouldBlockPublishedOfferEdit(params: {
  role: Role;
  currentStatus: OfferStatus;
  changedColumns?: readonly string[];
}): boolean {
  if (params.currentStatus !== "PUBLISHED" || canPublishContentDirectly(params.role)) return false;
  if (!params.changedColumns) return true;
  return decidePublishedOfferEdit({
    role: params.role,
    currentStatus: params.currentStatus,
    changedColumns: params.changedColumns,
  }).blocked;
}

const CONTENT_COLUMN_LABELS: Record<string, string> = {
  title: "название",
  description: "описание",
  coverImage: "фото",
  galleryImages: "фото",
  videoUrl: "видео",
  faqItems: "частые вопросы",
  classChipSlugs: "категории",
  category: "категория",
  discoverySignalIds: "интересы",
  occasions: "поводы",
  contactWebsite: "ссылки",
  priceCaption: "подпись к цене",
  priceText: "подпись к цене",
  contactPhoneLabel: "подписи к телефонам",
  contactPhone2Label: "подписи к телефонам",
  contactPhone3Label: "подписи к телефонам",
  contactSocialLinks: "ссылки",
  requestedPlacements: "разделы каталога",
  campSessionTexts: "тексты смен",
  status: "статус публикации",
};

/** Человеческое перечисление контентных полей для сообщения партнёру. */
export function describeContentColumns(columns: readonly string[]): string {
  const labels = [...new Set(columns.map((column) => CONTENT_COLUMN_LABELS[column] ?? "другие данные карточки"))];
  return labels.join(", ");
}

/** Сообщение партнёру: что ушло на поддержку и что сохранено сразу. */
export function buildModerationNoticeMessage(params: {
  contentColumns: readonly string[];
  operationalColumns: readonly string[];
}): string {
  const first = `Текст и фото опубликованного предложения пока меняются через поддержку: ${describeContentColumns(params.contentColumns)}.`;
  return params.operationalColumns.length > 0
    ? `${first} Цены, расписание и контакты сохранены`
    : first;
}

/** Поля смены лагеря, которые партнёр правит сразу: даты, время, места, цена. Остальное в смене — контент. */
export const CAMP_SESSION_OPERATIONAL_KEYS: ReadonlySet<string> = new Set([
  "id",
  "sortOrder",
  "dateFrom",
  "dateTo",
  "timeFrom",
  "timeTo",
  "capacity",
  "spotsLeft",
  "priceOverride",
]);

type CampSessionEntry = Record<string, unknown>;

/** `null`, `undefined` и sentinel-значения Prisma (`DbNull` / `JsonNull`). */
function isNullLike(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return false;
  const name = (value as { constructor?: { name?: string } }).constructor?.name;
  return name === "DbNull" || name === "JsonNull" || name === "AnyNull";
}

function asSessionList(value: unknown): CampSessionEntry[] {
  return Array.isArray(value)
    ? value.filter((item): item is CampSessionEntry => item !== null && typeof item === "object")
    : [];
}

/**
 * Опубликованный лагерь: `campSessions` — смесь операционных полей (даты, цена, места) и текста
 * (название, описание, акция, возраст, тип смены). Операционные поля берём из нового значения,
 * контентные — из живого (для новой смены контентных полей нет). `contentChanged` — партнёр
 * пытался изменить контент смен, это уйдёт на модерацию (в ревизию), а не в живую строку.
 *
 * Смены сопоставляются по `id`, без `id` — по позиции. Удаление смены — операционная правка.
 */
export function mergeCampSessionsForPublished(
  live: unknown,
  next: unknown,
): { merged: CampSessionEntry[]; contentChanged: boolean } {
  const liveList = asSessionList(live);
  if (isNullLike(next)) {
    // Полностью стереть смены опубликованного лагеря через прямую правку нельзя.
    return { merged: liveList, contentChanged: liveList.length > 0 };
  }

  const nextList = asSessionList(next);
  const liveById = new Map(
    liveList.filter((item) => typeof item.id === "string").map((item) => [item.id as string, item]),
  );
  let contentChanged = false;

  const merged = nextList.map((item, index) => {
    // Неизвестный `id` — новая смена (пустая основа); по позиции сопоставляем только смены без `id`.
    const match =
      typeof item.id === "string" ? liveById.get(item.id) : liveList[index];
    const base: CampSessionEntry = match ? { ...match } : {};

    for (const [key, value] of Object.entries(item)) {
      if (CAMP_SESSION_OPERATIONAL_KEYS.has(key)) {
        base[key] = value;
      } else if (!offerValuesEqual(value, match?.[key])) {
        contentChanged = true;
      }
    }
    return base;
  });

  return { merged, contentChanged };
}
