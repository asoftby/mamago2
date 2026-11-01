/**
 * Русские подписи enum-значений для админки (ТЗ «Аналитика админки», блок E).
 *
 * Правило: на экране основным текстом — только подпись из этого файла; сырой
 * код (`PENDING_REVIEW`, `CARD_VIEW`) допустим лишь в подсказке (`title`) или
 * в блоке «Техническая информация». Словари типизированы по enum'ам Prisma:
 * новое значение в схеме без подписи не пройдёт `tsc`.
 */
import type {
  AnalyticsEntityType,
  AnalyticsVertical,
  BillingTransactionStatus,
  BroadcastStatus,
  BusinessStatus,
  BusinessVerificationStatus,
  ContentStatus,
  ContractStatus,
  EmailTemplateStatus,
  NotificationAudience,
  OfferStatus,
  PlaceReviewStatus,
  PlacementStatus,
  PromotionStatus,
  Role,
  SubscriptionStatus,
  UserEventType,
  UserStatus,
} from "@prisma/client";

export const ROLE_LABELS_RU: Record<Role, string> = {
  USER: "Пользователь",
  BUSINESS_OWNER: "Владелец бизнеса",
  MODERATOR: "Модератор",
  ADMIN: "Администратор",
};

export const USER_STATUS_LABELS_RU: Record<UserStatus, string> = {
  PENDING_ACTIVATION: "Ждёт активации",
  ACTIVE: "Активен",
  LIMITED: "Ограничен",
  SUSPENDED: "Приостановлен",
  BANNED: "Заблокирован",
};

export const CONTENT_STATUS_LABELS_RU: Record<ContentStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  NEEDS_REVISION: "Нужны правки",
  REJECTED: "Отклонено",
  DELETED: "Удалено",
  PENDING_UPDATE: "Правки на модерации",
  SCHEDULED: "Запланировано",
  ARCHIVED: "В архиве",
};

export const OFFER_STATUS_LABELS_RU: Record<OfferStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

export const BROADCAST_STATUS_LABELS_RU: Record<BroadcastStatus, string> = {
  DRAFT: "Черновик",
  SCHEDULED: "Запланировано",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "В архиве",
};

export const EMAIL_TEMPLATE_STATUS_LABELS_RU: Record<EmailTemplateStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  ARCHIVED: "В архиве",
};

export const PLACE_REVIEW_STATUS_LABELS_RU: Record<PlaceReviewStatus, string> = {
  PENDING: "На модерации",
  PUBLISHED: "Опубликован",
  HIDDEN: "Скрыт",
};

export const BUSINESS_STATUS_LABELS_RU: Record<BusinessStatus, string> = {
  DRAFT: "Черновик",
  PENDING_REVIEW: "На проверке",
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
  PENDING_VERIFICATION: "Ждёт верификации",
};

export const BUSINESS_VERIFICATION_STATUS_LABELS_RU: Record<BusinessVerificationStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  APPROVED: "Подтверждена",
  REJECTED: "Отклонена",
  NEEDS_INFO: "Нужны данные",
};

export const BILLING_TRANSACTION_STATUS_LABELS_RU: Record<BillingTransactionStatus, string> = {
  PENDING: "В обработке",
  SUCCEEDED: "Выполнена",
  FAILED: "Ошибка",
  CANCELED: "Отменена",
  REVERSED: "Возвращена",
};

export const SUBSCRIPTION_STATUS_LABELS_RU: Record<SubscriptionStatus, string> = {
  ACTIVE: "Активна",
  PAST_DUE: "Просрочена",
  CANCELED: "Отменена",
  EXPIRED: "Истекла",
  TRIALING: "Пробный период",
};

export const PLACEMENT_STATUS_LABELS_RU: Record<PlacementStatus, string> = {
  ACTIVE: "Активно",
  EXPIRING: "Скоро закончится",
  EXPIRED: "Закончилось",
  PAUSED: "На паузе",
  CANCELED: "Отменено",
};

export const CONTRACT_STATUS_LABELS_RU: Record<ContractStatus, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Действует",
  EXPIRING: "Скоро закончится",
  EXPIRED: "Закончился",
  TERMINATED: "Расторгнут",
};

export const PROMOTION_STATUS_LABELS_RU: Record<PromotionStatus, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Идёт",
  PAUSED: "На паузе",
  COMPLETED: "Завершено",
};

export const NOTIFICATION_AUDIENCE_LABELS_RU: Record<NotificationAudience, string> = {
  USER: "Пользователи",
  BUSINESS: "Бизнесы",
  ADMIN: "Администраторы",
};

export const ENTITY_TYPE_LABELS_RU: Record<AnalyticsEntityType, string> = {
  EVENT: "Событие",
  PLACE: "Место",
  OFFER: "Предложение",
  ROUTE: "Маршрут",
  ARTICLE: "Статья",
};

export const VERTICAL_LABELS_RU: Record<AnalyticsVertical, string> = {
  CITY: "Город",
  TRAVEL: "Путешествия",
  BIRTHDAY: "Дни рождения",
  EDUCATION: "Образование",
  WEEKEND: "Выходные",
  SEASONAL: "Сезонное",
};

export const USER_EVENT_TYPE_LABELS_RU: Record<UserEventType, string> = {
  PAGE_VIEW: "Просмотр страницы",
  CARD_VIEW: "Показ в ленте",
  DETAIL_OPEN: "Открытие карточки",
  SAVE: "Сохранение",
  UNSAVE: "Удаление из сохранённых",
  PLAN_ADD: "Добавление в план",
  PLAN_REMOVE: "Удаление из плана",
  CTA_CLICK: "Переход к партнёру",
  SEARCH_APPLY: "Поиск",
  FILTER_APPLY: "Применение фильтра",
  BOOKING_CREATED: "Бронь создана",
  BOOKING_CONFIRMED: "Бронь подтверждена",
  BOOKING_COMPLETED: "Бронь выполнена",
  BOOKING_CANCELLED: "Бронь отменена",
  FEEDBACK_LEFT: "Оставлен отзыв",
  AUTH_STARTED: "Начат вход",
  AUTH_COMPLETED: "Вход выполнен",
  FAMILY_ONBOARDING_STARTED: "Начато заполнение семьи",
  CHILD_SAVED: "Ребёнок сохранён",
  CHILD_CONTEXT_COMPLETED: "Данные о ребёнке заполнены",
  ONBOARDING_COMPLETED: "Знакомство завершено",
  FIRST_PERSONALIZED_RESULT: "Первая персональная подборка",
  FIRST_PERSONALIZED_PLAN_ADD: "Первое добавление в план из подборки",
  PLAN_AUDIENCE_SNAPSHOT: "Снимок аудитории плана",
  ATTENDED: "Посещение",
  EXPERIENCE_FEEDBACK: "Отзыв о посещении",
  ATTENDANCE_CORRECTED: "Исправлено посещение: не были",
  PLAN_ITEM_SHARED: "Пункт плана открыт семье",
  PLAN_ITEM_MADE_PRIVATE: "Пункт плана скрыт",
  PLAN_ITEM_RESCHEDULED: "Пункт плана перенесён",
  DISMISS: "Скрыта рекомендация",
};

/**
 * Подпись по словарю. Неизвестное значение (например, новое в БД до обновления
 * словаря) показываем как есть — так пропуск виден сразу, а экран не пустеет.
 */
export function labelRu<K extends string>(
  dictionary: Readonly<Record<K, string>>,
  value: string | null | undefined,
  empty = "—",
): string {
  if (value == null || value === "") return empty;
  return (dictionary as Readonly<Record<string, string>>)[value] ?? value;
}

/** Есть ли подпись для значения (для проверок и тестов). */
export function hasLabelRu(dictionary: Readonly<Record<string, string>>, value: string): boolean {
  return Object.prototype.hasOwnProperty.call(dictionary, value);
}
