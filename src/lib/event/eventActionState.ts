/**
 * View model для состояния CTA на странице события.
 * Определяет, какие действия доступны и как они отображаются.
 */

export type EventActionType = "buy" | "register" | "book" | "external";

export interface EventActionState {
  /** Можно ли запланировать событие */
  canPlan: boolean;
  /** Событие уже в плане */
  isPlanned: boolean;
  /** Дата в плане (если isPlanned = true) */
  planDate?: string | null;
  /** Можно ли купить/записаться */
  canPurchase: boolean;
  /** Тип действия покупки */
  purchaseType?: EventActionType;
  /** URL для покупки/записи */
  purchaseUrl?: string;
  /** Текст для primary CTA */
  primaryLabel: string;
  /** Текст для secondary CTA */
  secondaryLabel?: string;
  /** Цена для отображения */
  priceLabel: string;
  /** Краткая информация о дате/времени */
  sessionLabel?: string;
}

/**
 * Определяет тип действия покупки на основе данных события
 */
export function determinePurchaseType(
  bookingNotes?: string,
  categoryLabel?: string
): EventActionType {
  const notes = (bookingNotes || "").toLowerCase();
  const category = (categoryLabel || "").toLowerCase();

  // Если есть явные признаки регистрации
  if (
    notes.includes("регистрац") ||
    notes.includes("запис") ||
    category.includes("занят") ||
    category.includes("мастер-класс")
  ) {
    return "register";
  }

  // Если есть признаки бронирования
  if (notes.includes("бронирован") || notes.includes("резерв")) {
    return "book";
  }

  // По умолчанию - покупка билета
  return "buy";
}

/**
 * Возвращает текст для secondary CTA в зависимости от типа действия
 */
export function getPurchaseLabel(type: EventActionType): string {
  switch (type) {
    case "register":
      return "Записаться";
    case "book":
      return "Забронировать";
    case "buy":
      return "Купить билет";
    case "external":
      return "Подробнее";
    default:
      return "Купить билет";
  }
}

/** Compact plan CTA months: «24 ноя.» (not locale «нояб.»). */
const PLAN_MONTHS_SHORT = [
  "янв.",
  "фев.",
  "мар.",
  "апр.",
  "мая",
  "июн.",
  "июл.",
  "авг.",
  "сен.",
  "окт.",
  "ноя.",
  "дек.",
] as const;

/**
 * Форматирует дату плана для отображения (например "24 ноя.").
 * Accepts YYYY-MM-DD plan keys without UTC day-shift.
 */
export function formatPlanDateShort(dateISO: string): string {
  try {
    const key = dateISO.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const month = Number(key.slice(5, 7));
      const day = Number(key.slice(8, 10));
      if (month < 1 || month > 12 || day < 1 || day > 31) return dateISO;
      return `${day} ${PLAN_MONTHS_SHORT[month - 1]}`;
    }
    // Full ISO: read the calendar day in Europe/Minsk, then reuse compact months.
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Minsk",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(dateISO));
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !d) return dateISO;
    return formatPlanDateShort(`${y}-${m}-${d}`);
  } catch {
    return dateISO;
  }
}

/**
 * Создает состояние действий для события
 */
export function buildEventActionState(params: {
  isPlanned: boolean;
  planDate?: string | null;
  priceLabel: string;
  sessionLabel?: string;
  bookingNotes?: string;
  categoryLabel?: string;
  ctaConfig: {
    planLabel: string;
    buyLabel: string;
  };
  /** Есть ли возможность покупки (ticketUrl, registrationUrl и т.д.) */
  hasPurchaseCapability?: boolean;
  purchaseUrl?: string;
}): EventActionState {
  const {
    isPlanned,
    planDate,
    priceLabel,
    sessionLabel,
    bookingNotes,
    categoryLabel,
    ctaConfig,
    hasPurchaseCapability = false,
    purchaseUrl,
  } = params;

  const purchaseType = determinePurchaseType(bookingNotes, categoryLabel);

  return {
    canPlan: true,
    isPlanned,
    planDate,
    canPurchase: hasPurchaseCapability,
    purchaseType,
    purchaseUrl,
    primaryLabel: isPlanned
      ? planDate
        ? `✓ В плане на ${formatPlanDateShort(planDate)}`
        : "✓ В плане"
      : ctaConfig.planLabel,
    secondaryLabel: hasPurchaseCapability
      ? getPurchaseLabel(purchaseType)
      : undefined,
    priceLabel,
    sessionLabel,
  };
}
