/**
 * Notification Registry — единый источник правды для системы уведомлений mamaGo.by 2.0
 *
 * Этот файл содержит полное описание всех типов уведомлений:
 * - audience, surface, channels
 * - routing, CTA, Telegram templates
 * - группировка для настроек
 *
 * Цель: заменить дублирование в settingsDomain.ts, streamFilters.ts, routing.ts, TelegramTemplateRenderer.ts
 *
 * ВАЖНО: Этот файл должен быть client-safe (без server-only зависимостей)
 */

import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationAudience = "USER" | "BUSINESS" | "ADMIN";
export type NotificationSurface = "USER" | "BUSINESS" | "ADMIN";
export type NotificationImportance = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type NotificationCategory = "SYSTEM" | "MODERATION" | "BOOKING" | "PLAN" | "BUSINESS" | "MARKETING" | "ADMIN";

export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
}

export interface NotificationTelegramConfig {
  enabledByDefault: boolean;
  /** Template key для TelegramTemplateRenderer или inline template */
  template?: string;
  /** Inline title template (если не используется renderer key) */
  title?: string;
  /** Inline body template (если не используется renderer key) */
  body?: string;
}

export interface NotificationRegistryEntry {
  type: string;
  audience: NotificationAudience;
  surface: NotificationSurface;
  /** Группа для настроек (соответствует settingsDomain.ts) */
  groupId: string;
  label: string;
  description: string;
  defaultChannels: NotificationChannels;
  /** Тип сущности для entityType поля */
  entityType?: string;
  /** Текст кнопки CTA */
  ctaLabel?: string;
  /** Функция для построения href из notification */
  resolveHref?: (notification: { entityType?: string; entityId?: string; ctaAction?: string }) => string | null;
  telegram: NotificationTelegramConfig;
  importance: NotificationImportance;
  category: NotificationCategory;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const NOTIFICATION_REGISTRY: Record<string, NotificationRegistryEntry> = {
  // ── System & Welcome ──
  WELCOME: {
    type: "WELCOME",
    audience: "USER",
    surface: "USER",
    groupId: "system",
    label: "Добро пожаловать",
    description: "Приветственное сообщение для новых пользователей",
    defaultChannels: { inApp: true, email: true, telegram: true },
    ctaLabel: "Начать",
    resolveHref: () => "/",
    telegram: {
      enabledByDefault: true,
      template: "welcome",
    },
    importance: "NORMAL",
    category: "SYSTEM",
  },

  SYSTEM: {
    type: "SYSTEM",
    audience: "USER",
    surface: "USER",
    groupId: "system",
    label: "Системные уведомления",
    description: "Важные системные сообщения",
    defaultChannels: { inApp: true, email: false, telegram: true },
    ctaLabel: "Настройки",
    resolveHref: () => "/settings",
    telegram: {
      enabledByDefault: true,
      template: "system",
    },
    importance: "HIGH",
    category: "SYSTEM",
  },

  REMINDER: {
    type: "REMINDER",
    audience: "USER",
    surface: "USER",
    groupId: "recommendations",
    label: "Напоминания",
    description: "Напоминания о событиях и планах",
    defaultChannels: { inApp: true, email: false, telegram: true },
    ctaLabel: "Мои планы",
    resolveHref: () => "/me/plan",
    telegram: {
      enabledByDefault: true,
      template: "reminder",
    },
    importance: "NORMAL",
    category: "PLAN",
  },

  PLAN_TOMORROW_DIGEST: {
    type: "PLAN_TOMORROW_DIGEST",
    audience: "USER",
    surface: "USER",
    groupId: "user_bookings",
    label: "Завтра в плане",
    description: "Ежедневное напоминание о том, что запланировано на завтра",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "PLAN_DIGEST",
    ctaLabel: "Открыть мой план",
    resolveHref: () => "/me/plan",
    telegram: {
      enabledByDefault: true,
      template: "plan_tomorrow_digest",
    },
    importance: "NORMAL",
    category: "PLAN",
  },

  RECOMMENDATION: {
    type: "RECOMMENDATION",
    audience: "USER",
    surface: "USER",
    groupId: "recommendations",
    label: "Рекомендации",
    description: "Персональные рекомендации событий и мест",
    defaultChannels: { inApp: true, email: false, telegram: false },
    resolveHref: () => null, // No deep link, stay in app
    telegram: {
      enabledByDefault: false,
      template: "recommendation",
    },
    importance: "LOW",
    category: "MARKETING",
  },

  NEWS: {
    type: "NEWS",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "news",
    label: "Новости",
    description: "Новости платформы и обновления",
    defaultChannels: { inApp: true, email: false, telegram: false },
    ctaLabel: "Читать",
    resolveHref: (n) => n.ctaAction || null, // Use ctaAction if provided
    telegram: {
      enabledByDefault: false,
      template: "news",
    },
    importance: "LOW",
    category: "MARKETING",
  },

  ANNOUNCEMENT: {
    type: "ANNOUNCEMENT",
    audience: "USER",
    surface: "USER",
    groupId: "system",
    label: "Объявления",
    description: "Важные объявления администрации",
    defaultChannels: { inApp: true, email: true, telegram: true },
    ctaLabel: "Подробнее",
    resolveHref: (n) => n.ctaAction || null, // Use ctaAction if provided
    telegram: {
      enabledByDefault: true,
      template: "announcement",
    },
    importance: "HIGH",
    category: "SYSTEM",
  },

  // ── Place Moderation ──
  PLACE_APPROVED: {
    type: "PLACE_APPROVED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Место одобрено",
    description: "Место прошло модерацию и опубликовано",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "PLACE",
    ctaLabel: "Открыть место",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/place/${n.entityId}/edit` : "/business/places"),
    telegram: {
      enabledByDefault: true,
      template: "place_approved",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  PLACE_NEEDS_CHANGES: {
    type: "PLACE_NEEDS_CHANGES",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Место требует изменений",
    description: "Место отправлено на доработку",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "PLACE",
    ctaLabel: "Исправить",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/place/${n.entityId}/edit` : "/business/places"),
    telegram: {
      enabledByDefault: true,
      template: "place_needs_changes",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  PLACE_REJECTED: {
    type: "PLACE_REJECTED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Место отклонено",
    description: "Место не прошло модерацию",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "PLACE",
    ctaLabel: "Подробнее",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/place/${n.entityId}/edit` : "/business/places"),
    telegram: {
      enabledByDefault: true,
      template: "place_rejected",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  PLACE_UPDATE_APPROVED: {
    type: "PLACE_UPDATE_APPROVED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Обновление места одобрено",
    description: "Изменения места опубликованы",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "PLACE",
    ctaLabel: "Открыть место",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/place/${n.entityId}/edit` : "/business/places"),
    telegram: {
      enabledByDefault: true,
      template: "place_update_approved",
    },
    importance: "NORMAL",
    category: "MODERATION",
  },

  PLACE_UPDATE_NEEDS_REVISION: {
    type: "PLACE_UPDATE_NEEDS_REVISION",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Обновление места требует доработки",
    description: "Изменения места отправлены на доработку",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "PLACE",
    ctaLabel: "Исправить",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/place/${n.entityId}/edit` : "/business/places"),
    telegram: {
      enabledByDefault: true,
      template: "place_update_needs_revision",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  PLACE_UPDATE_REJECTED: {
    type: "PLACE_UPDATE_REJECTED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Обновление места отклонено",
    description: "Изменения места не приняты",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "PLACE",
    ctaLabel: "Подробнее",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/place/${n.entityId}/edit` : "/business/places"),
    telegram: {
      enabledByDefault: true,
      template: "place_update_rejected",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  // ── Activity Moderation ──
  ACTIVITY_APPROVED: {
    type: "ACTIVITY_APPROVED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Активность одобрена",
    description: "Активность прошла модерацию и опубликована",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "ACTIVITY",
    ctaLabel: "Открыть активность",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/event/${n.entityId}/edit` : "/business/events"),
    telegram: {
      enabledByDefault: true,
      template: "activity_approved",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  ACTIVITY_NEEDS_CHANGES: {
    type: "ACTIVITY_NEEDS_CHANGES",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Активность требует изменений",
    description: "Активность отправлена на доработку",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "ACTIVITY",
    ctaLabel: "Исправить",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/event/${n.entityId}/edit` : "/business/events"),
    telegram: {
      enabledByDefault: true,
      template: "activity_needs_changes",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  ACTIVITY_REJECTED: {
    type: "ACTIVITY_REJECTED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Активность отклонена",
    description: "Активность не прошла модерацию",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "ACTIVITY",
    ctaLabel: "Подробнее",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/event/${n.entityId}/edit` : "/business/events"),
    telegram: {
      enabledByDefault: true,
      template: "activity_rejected",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  // ── Offer Moderation ──
  OFFER_APPROVED: {
    type: "OFFER_APPROVED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Предложение одобрено",
    description: "Предложение прошло модерацию и опубликовано",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "OFFER",
    ctaLabel: "Открыть предложение",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/offer/${n.entityId}/edit` : "/business/offers"),
    telegram: {
      enabledByDefault: true,
      template: "offer_approved",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  OFFER_NEEDS_CHANGES: {
    type: "OFFER_NEEDS_CHANGES",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Предложение требует изменений",
    description: "Предложение отправлено на доработку",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "OFFER",
    ctaLabel: "Исправить",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/offer/${n.entityId}/edit` : "/business/offers"),
    telegram: {
      enabledByDefault: true,
      template: "offer_needs_changes",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  OFFER_REJECTED: {
    type: "OFFER_REJECTED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "moderation",
    label: "Предложение отклонено",
    description: "Предложение не прошло модерацию",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "OFFER",
    ctaLabel: "Подробнее",
    resolveHref: (n) => n.ctaAction || (n.entityId ? `/editor/offer/${n.entityId}/edit` : "/business/offers"),
    telegram: {
      enabledByDefault: true,
      template: "offer_rejected",
    },
    importance: "HIGH",
    category: "MODERATION",
  },

  // ── Business Verification ──
  BUSINESS_VERIFIED: {
    type: "BUSINESS_VERIFIED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business",
    label: "Бизнес верифицирован",
    description: "Ваш бизнес-аккаунт успешно верифицирован",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "BUSINESS",
    ctaLabel: "Открыть кабинет",
    resolveHref: () => "/business/verification",
    telegram: {
      enabledByDefault: true,
      template: "business_verified",
    },
    importance: "HIGH",
    category: "BUSINESS",
  },

  BUSINESS_REJECTED: {
    type: "BUSINESS_REJECTED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business",
    label: "Заявка на бизнес отклонена",
    description: "Заявка на верификацию бизнеса отклонена",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "BUSINESS",
    ctaLabel: "Подать заново",
    resolveHref: () => "/business/verification",
    telegram: {
      enabledByDefault: true,
      template: "business_rejected",
    },
    importance: "HIGH",
    category: "BUSINESS",
  },

  BUSINESS_NEEDS_INFO: {
    type: "BUSINESS_NEEDS_INFO",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business",
    label: "Нужна дополнительная информация",
    description: "Для верификации бизнеса нужны дополнительные данные",
    defaultChannels: { inApp: true, email: true, telegram: true },
    entityType: "BUSINESS",
    ctaLabel: "Дополнить",
    resolveHref: () => "/business/verification",
    telegram: {
      enabledByDefault: true,
      template: "business_needs_info",
    },
    importance: "HIGH",
    category: "BUSINESS",
  },

  BUSINESS_VERIFICATION_SUBMITTED: {
    type: "BUSINESS_VERIFICATION_SUBMITTED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business",
    label: "Заявка на верификацию отправлена",
    description: "Профиль бизнеса принят и отправлен на модерацию",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BUSINESS",
    ctaLabel: "Статус заявки",
    resolveHref: () => "/business/verification",
    telegram: {
      enabledByDefault: true,
      template: "business_verification_submitted",
    },
    importance: "NORMAL",
    category: "BUSINESS",
  },

  BUSINESS_APPLICATION_CREATED: {
    type: "BUSINESS_APPLICATION_CREATED",
    audience: "ADMIN",
    surface: "ADMIN",
    groupId: "admin_moderation",
    label: "Новая заявка на бизнес",
    description: "Поступила новая заявка на верификацию бизнеса",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BUSINESS",
    ctaLabel: "Проверить",
    resolveHref: (n) => n.entityId ? `/admin/b2b/requests?status=PENDING&open=${n.entityId}` : "/admin/b2b/requests?status=PENDING",
    telegram: {
      enabledByDefault: true,
      template: "business_application_created",
    },
    importance: "NORMAL",
    category: "ADMIN",
  },

  ADMIN_MODERATION_ITEM_CREATED: {
    type: "ADMIN_MODERATION_ITEM_CREATED",
    audience: "ADMIN",
    surface: "ADMIN",
    groupId: "admin_moderation",
    label: "Новый элемент на модерацию",
    description: "Поступил новый элемент для модерации",
    defaultChannels: { inApp: true, email: false, telegram: true },
    ctaLabel: "Проверить",
    resolveHref: (n) => n.ctaAction || "/admin/moderation",
    telegram: {
      enabledByDefault: true,
      template: "admin_moderation_item_created",
    },
    importance: "NORMAL",
    category: "ADMIN",
  },

  // ── Booking ──
  BOOKING_CREATED: {
    type: "BOOKING_CREATED",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "bookings",
    label: "Новая заявка",
    description: "Поступила новая заявка на запись",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BOOKING",
    ctaLabel: "Открыть заявки",
    resolveHref: () => "/business/bookings",
    telegram: {
      enabledByDefault: true,
      template: "booking_created",
    },
    importance: "HIGH",
    category: "BOOKING",
  },

  BOOKING_STALE: {
    type: "BOOKING_STALE",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "bookings",
    label: "Заявка ждёт ответа",
    description: "Новая заявка не обработана более 24 часов",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BOOKING",
    ctaLabel: "Открыть заявки",
    resolveHref: () => "/business/bookings",
    telegram: {
      enabledByDefault: true,
      title: "Заявка ждёт ответа",
      body: "{{body}}", // Используется динамический body из service
    },
    importance: "HIGH",
    category: "BOOKING",
  },

  BOOKING_NEEDS_ATTENTION: {
    type: "BOOKING_NEEDS_ATTENTION",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "bookings",
    label: "Требует внимания",
    description: "Подтверждённая заявка без активности более 3 дней",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BOOKING",
    ctaLabel: "Открыть заявки",
    resolveHref: () => "/business/bookings",
    telegram: {
      enabledByDefault: true,
      title: "Требует внимания",
      body: "{{body}}", // Используется динамический body из service
    },
    importance: "NORMAL",
    category: "BOOKING",
  },

  // ── User Booking Lifecycle ──
  BOOKING_CONFIRMED: {
    type: "BOOKING_CONFIRMED",
    audience: "USER",
    surface: "USER",
    groupId: "user_bookings",
    label: "Заявка подтверждена",
    description: "Бизнес подтвердил вашу заявку на запись",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BOOKING",
    ctaLabel: "Мои записи",
    resolveHref: () => "/me/bookings",
    telegram: {
      enabledByDefault: true,
      title: "Заявка подтверждена",
      body: "{{body}}",
    },
    importance: "HIGH",
    category: "BOOKING",
  },

  BOOKING_CANCELLED: {
    type: "BOOKING_CANCELLED",
    audience: "USER",
    surface: "USER",
    groupId: "user_bookings",
    label: "Заявка отклонена",
    description: "Бизнес отклонил вашу заявку на запись",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BOOKING",
    ctaLabel: "Мои записи",
    resolveHref: () => "/me/bookings",
    telegram: {
      enabledByDefault: true,
      title: "Заявка отклонена",
      body: "{{body}}",
    },
    importance: "HIGH",
    category: "BOOKING",
  },

  BOOKING_COMPLETED: {
    type: "BOOKING_COMPLETED",
    audience: "USER",
    surface: "USER",
    groupId: "user_bookings",
    label: "Заявка завершена",
    description: "Ваша заявка на запись завершена",
    defaultChannels: { inApp: true, email: false, telegram: false },
    entityType: "BOOKING",
    ctaLabel: "Мои записи",
    resolveHref: () => "/me/bookings",
    telegram: {
      enabledByDefault: false,
      title: "Заявка завершена",
      body: "{{body}}",
    },
    importance: "NORMAL",
    category: "BOOKING",
  },

  BOOKING_FEEDBACK_REQUEST: {
    type: "BOOKING_FEEDBACK_REQUEST",
    audience: "USER",
    surface: "USER",
    groupId: "user_bookings",
    label: "Оставьте отзыв",
    description: "Поделитесь впечатлениями о посещении",
    defaultChannels: { inApp: true, email: false, telegram: true },
    entityType: "BOOKING",
    ctaLabel: "Оставить отзыв",
    resolveHref: () => "/me/bookings",
    telegram: {
      enabledByDefault: true,
      title: "Как прошло?",
      body: "{{body}}",
    },
    importance: "LOW",
    category: "BOOKING",
  },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Получить запись registry по типу уведомления
 */
export function getNotificationRegistryEntry(type: string): NotificationRegistryEntry | null {
  return NOTIFICATION_REGISTRY[type] ?? null;
}

/**
 * Получить все типы уведомлений для конкретной поверхности
 */
export function getNotificationTypesForSurface(surface: NotificationSurface): string[] {
  return Object.values(NOTIFICATION_REGISTRY)
    .filter(entry => entry.surface === surface)
    .map(entry => entry.type);
}

/**
 * Получить все типы уведомлений для конкретной аудитории
 */
export function getNotificationTypesForAudience(audience: NotificationAudience): string[] {
  return Object.values(NOTIFICATION_REGISTRY)
    .filter(entry => entry.audience === audience)
    .map(entry => entry.type);
}

/**
 * Получить каналы по умолчанию для типа уведомления
 */
export function getNotificationDefaultChannels(type: string): NotificationChannels | null {
  const entry = getNotificationRegistryEntry(type);
  return entry?.defaultChannels ?? null;
}

/**
 * Построить href для уведомления
 */
export function resolveNotificationHref(
  type: string,
  notification: { entityType?: string; entityId?: string; ctaAction?: string }
): string | null {
  const entry = getNotificationRegistryEntry(type);
  if (!entry?.resolveHref) return null;
  
  try {
    return entry.resolveHref(notification);
  } catch {
    return null;
  }
}

/**
 * Получить строки настроек для поверхности (для замены settingsDomain.ts)
 */
export function getNotificationSettingsRows(surface: NotificationSurface): Array<{
  groupId: string;
  types: string[];
}> {
  const groups = new Map<string, string[]>();
  
  Object.values(NOTIFICATION_REGISTRY)
    .filter(entry => entry.surface === surface)
    .forEach(entry => {
      const existing = groups.get(entry.groupId) ?? [];
      existing.push(entry.type);
      groups.set(entry.groupId, existing);
    });
  
  return Array.from(groups.entries()).map(([groupId, types]) => ({ groupId, types }));
}

/**
 * Получить типы для stream фильтра (для замены streamFilters.ts)
 */
export function getNotificationStreamTypes(surface: NotificationSurface): string[] {
  return getNotificationTypesForSurface(surface);
}

// ─── Development Validation ───────────────────────────────────────────────────

/**
 * Dev-only validation: проверить соответствие registry и Prisma enum
 * Вызывается только в development mode
 */
export function validateNotificationRegistry(prismaNotificationTypes: string[]): void {
  if (process.env.NODE_ENV !== "development") return;
  
  const registryTypes = Object.keys(NOTIFICATION_REGISTRY);
  const missingInPrisma = registryTypes.filter(type => !prismaNotificationTypes.includes(type));
  const missingInRegistry = prismaNotificationTypes.filter(type => !registryTypes.includes(type));
  
  if (missingInPrisma.length > 0) {
    console.warn(
      "[NotificationRegistry] Types in registry but missing in Prisma enum:",
      missingInPrisma
    );
  }
  
  if (missingInRegistry.length > 0) {
    console.warn(
      "[NotificationRegistry] Types in Prisma enum but missing in registry:",
      missingInRegistry,
      "\nThese should be added to registry or marked as LEGACY/UNUSED"
    );
  }
  
  if (missingInPrisma.length === 0 && missingInRegistry.length === 0) {
    console.debug("[NotificationRegistry] ✅ Registry and Prisma enum are in sync");
  }
}

// ─── Scenario Template Registry ───────────────────────────────────────────────
//
// Сценарий — единица настройки шаблонов уведомлений: для каждого сценария
// определены Zod-схема переменных payload, сэмпл для превью/тестов и дефолтные
// шаблоны per-канал. Дефолты живут в коде; запись NotificationTemplate в БД —
// это override (см. prisma/schema.prisma → NotificationTemplate).
//
// Синтаксис шаблона: {{var}} — простая интерполяция, без выражений и eval.
// subject: для EMAIL — тема письма, для IN_APP/TELEGRAM — заголовок сообщения.
// CTA (label/url) шаблонами не настраивается — задаётся кодом/registry.
//
// Список сценариев определяется ТОЛЬКО здесь. Админка сценарии не создаёт.

export type ScenarioTemplateChannel = "IN_APP" | "EMAIL" | "TELEGRAM";

export type ScenarioTemplateDefault =
  | { kind: "template"; subject: string | null; body: string }
  /**
   * Дефолтный рендер остаётся за кодом (React Email-компонент);
   * override из БД заменяет его {{var}}-шаблоном.
   */
  | { kind: "code"; note: string };

export interface NotificationScenarioDefinition {
  key: string;
  audience: NotificationAudience;
  description: string;
  /** Плоские строковые переменные, доступные в шаблоне как {{var}} */
  payloadSchema: z.ZodObject<z.ZodRawShape>;
  /** Сэмпл-payload для live-превью и валидации шаблонов */
  samplePayload: Record<string, string>;
  /** Дефолтные шаблоны по каналам; канал без дефолта шаблонами не рендерится */
  defaults: Partial<Record<ScenarioTemplateChannel, ScenarioTemplateDefault>>;
  /**
   * true — сценарий сгенерирован из legacy NotificationType с generic-схемой
   * {title, body, ctaLabel, ctaUrl}: тексты формируются в notifyXxx и
   * прокидываются в шаблон как готовые строки.
   */
  isLegacyGeneric: boolean;
}

/**
 * Иконка Telegram-сообщения по типу уведомления.
 * Перенесено из TelegramTemplateRenderer (префиксная логика) — единый источник
 * для генерации дефолтных шаблонов и канального рендера.
 */
export function getTelegramIconForNotificationType(type: string): string {
  if (type.startsWith("BOOKING_")) return "📌";
  if (type.startsWith("PLACE_")) return "📍";
  if (type.startsWith("ACTIVITY_")) return "🎟️";
  if (type.startsWith("OFFER_")) return "🎁";
  if (type.startsWith("BUSINESS_")) return "🏢";
  if (type.startsWith("ADMIN_")) return "🛠";
  if (type === "REMINDER" || type === "PLAN_TOMORROW_DIGEST") return "⏰";
  return "🔔";
}

/** Generic-схема legacy-сценариев (вариант А): готовые строки из notifyXxx. */
const legacyNotificationPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
});

const LEGACY_SAMPLE_PAYLOAD: Record<string, string> = {
  title: "Заголовок уведомления",
  body: "Текст уведомления для предпросмотра шаблона.",
  ctaLabel: "Открыть",
  ctaUrl: "/me",
};

/**
 * Явные сценарии: богатые схемы переменных и дефолтные тексты,
 * перенесённые 1:1 из текущих хардкодов
 * (notification-renderer-core.ts, notifyBookingCreated, email-service).
 */
const EXPLICIT_SCENARIO_DEFINITIONS: Record<string, NotificationScenarioDefinition> = {
  PLAN_EVENT_2H_BEFORE: {
    key: "PLAN_EVENT_2H_BEFORE",
    audience: "USER",
    description: "Напоминание о событии в плане перед началом.",
    payloadSchema: z.object({
      eventTitle: z.string(),
      startsAtTime: z.string(),
      startsAtDate: z.string(),
      placeName: z.string().optional(),
      cityName: z.string().optional(),
    }),
    samplePayload: {
      eventTitle: "Детская йога в парке",
      startsAtTime: "16:00",
      startsAtDate: "2026-06-12",
      placeName: "Парк Горького",
      cityName: "Минск",
    },
    defaults: {
      IN_APP: {
        kind: "template",
        subject: "Скоро событие",
        body: "В {{startsAtTime}} у вас в плане: {{eventTitle}}",
      },
      EMAIL: {
        kind: "template",
        subject: "Скоро событие",
        body: "В {{startsAtTime}} у вас в плане: {{eventTitle}}",
      },
      TELEGRAM: {
        kind: "template",
        subject: "Скоро событие",
        body: "В {{startsAtTime}} у вас в плане: {{eventTitle}}",
      },
    },
    isLegacyGeneric: false,
  },

  PLAN_TOMORROW_DIGEST: {
    key: "PLAN_TOMORROW_DIGEST",
    audience: "USER",
    description: "Сводка на завтра по событиям в плане пользователя.",
    payloadSchema: z.object({
      digestDate: z.string(),
      /** Готовые строки позиций дайджеста (время — название — место), собираются кодом */
      itemsText: z.string(),
    }),
    samplePayload: {
      digestDate: "2026-06-12",
      itemsText: "10:00 — Детская йога в парке\n📍 Парк Горького\n\n14:00 — Мастер-класс по лепке\n📍 Студия «Глина»",
    },
    defaults: {
      IN_APP: { kind: "template", subject: "Завтра в плане", body: "{{itemsText}}" },
      EMAIL: { kind: "template", subject: "Завтра в плане", body: "{{itemsText}}" },
      TELEGRAM: { kind: "template", subject: "Завтра в плане", body: "{{itemsText}}" },
    },
    isLegacyGeneric: false,
  },

  BOOKING_CREATED: {
    key: "BOOKING_CREATED",
    audience: "BUSINESS",
    description: "Новая заявка на запись для бизнеса.",
    payloadSchema: z.object({
      /** Готовая фраза из buildBookingNotificationBody — дефолт использует её 1:1 */
      bookingSummary: z.string(),
      /** «Имя ребёнка (N лет)» либо имя клиента — как в текущем форматтере */
      actor: z.string(),
      customerName: z.string(),
      childName: z.string().optional(),
      childAge: z.string().optional(),
      offerTitle: z.string().optional(),
      activityTitle: z.string().optional(),
      placeTitle: z.string().optional(),
      campShiftTitle: z.string().optional(),
      campShiftDateFrom: z.string().optional(),
      campShiftDateTo: z.string().optional(),
    }),
    samplePayload: {
      bookingSummary: "Маша (6 лет) оставил заявку на «Детская йога»",
      actor: "Маша (6 лет)",
      customerName: "Анна Петрова",
      childName: "Маша",
      childAge: "6",
      offerTitle: "Детская йога",
    },
    defaults: {
      IN_APP: { kind: "template", subject: "Новая заявка", body: "{{bookingSummary}}" },
      EMAIL: { kind: "template", subject: "Новая заявка", body: "{{bookingSummary}}" },
      TELEGRAM: { kind: "template", subject: "📌 Новая заявка", body: "{{bookingSummary}}" },
    },
    isLegacyGeneric: false,
  },

  VERIFY_EMAIL: {
    key: "VERIFY_EMAIL",
    audience: "USER",
    description: "Подтверждение email-адреса (transactional).",
    payloadSchema: z.object({
      verifyUrl: z.string(),
    }),
    samplePayload: {
      verifyUrl: "https://mamago.by/verify-email?token=demo",
    },
    defaults: {
      EMAIL: {
        kind: "code",
        note: "React Email: VerifyEmailTemplate (src/features/email/templates/verify-email)",
      },
    },
    isLegacyGeneric: false,
  },

  RESET_PASSWORD: {
    key: "RESET_PASSWORD",
    audience: "USER",
    description: "Восстановление пароля (transactional).",
    payloadSchema: z.object({
      resetUrl: z.string(),
    }),
    samplePayload: {
      resetUrl: "https://mamago.by/reset-password?token=demo",
    },
    defaults: {
      EMAIL: {
        kind: "code",
        note: "React Email: PasswordResetTemplate (src/features/email/templates/password-reset)",
      },
    },
    isLegacyGeneric: false,
  },

  WELCOME_EMAIL: {
    key: "WELCOME_EMAIL",
    audience: "USER",
    description: "Приветственное письмо новому пользователю (transactional). Ключ отделён от in-app типа WELCOME.",
    payloadSchema: z.object({
      userName: z.string().optional(),
      ctaUrl: z.string(),
    }),
    samplePayload: {
      userName: "Анна",
      ctaUrl: "https://mamago.by/me",
    },
    defaults: {
      EMAIL: {
        kind: "code",
        note: "React Email: MamagoWelcomeTemplate (emails/mamago-welcome)",
      },
    },
    isLegacyGeneric: false,
  },
};

/**
 * Legacy-сценарий из записи NOTIFICATION_REGISTRY: generic-схема, дефолты
 * воспроизводят текущий рендер 1:1 (in-app/email — passthrough title/body,
 * telegram — иконка + title/body из telegram-конфига registry).
 */
function buildLegacyScenarioDefinition(
  entry: NotificationRegistryEntry,
): NotificationScenarioDefinition {
  const icon = getTelegramIconForNotificationType(entry.type);

  return {
    key: entry.type,
    audience: entry.audience,
    description: entry.description,
    payloadSchema: legacyNotificationPayloadSchema,
    samplePayload: { ...LEGACY_SAMPLE_PAYLOAD },
    defaults: {
      IN_APP: { kind: "template", subject: "{{title}}", body: "{{body}}" },
      EMAIL: { kind: "template", subject: "{{title}}", body: "{{body}}" },
      TELEGRAM: {
        kind: "template",
        subject: `${icon} ${entry.telegram.title ?? "{{title}}"}`,
        body: entry.telegram.body ?? "{{body}}",
      },
    },
    isLegacyGeneric: true,
  };
}

export const NOTIFICATION_SCENARIO_REGISTRY: Record<string, NotificationScenarioDefinition> = {
  ...Object.fromEntries(
    Object.values(NOTIFICATION_REGISTRY)
      .filter((entry) => !(entry.type in EXPLICIT_SCENARIO_DEFINITIONS))
      .map((entry) => [entry.type, buildLegacyScenarioDefinition(entry)]),
  ),
  ...EXPLICIT_SCENARIO_DEFINITIONS,
};

export function getNotificationScenarioDefinition(
  key: string,
): NotificationScenarioDefinition | null {
  return NOTIFICATION_SCENARIO_REGISTRY[key] ?? null;
}

/** Список переменных, разрешённых в шаблонах сценария (для валидации и подсказок в UI). */
export function getScenarioTemplateVariables(key: string): string[] {
  const definition = getNotificationScenarioDefinition(key);
  if (!definition) return [];
  return Object.keys(definition.payloadSchema.shape);
}
