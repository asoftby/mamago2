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

/**
 * Форматирует дату плана для отображения
 */
export function formatPlanDateShort(dateISO: string): string {
  try {
    const date = new Date(dateISO);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
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
