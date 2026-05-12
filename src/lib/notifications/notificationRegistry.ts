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
    resolveHref: () => "/me",
    telegram: {
      enabledByDefault: true,
      template: "reminder",
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
    resolveHref: (n) => n.ctaAction || `/business/places/${n.entityId}`,
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
    resolveHref: (n) => n.ctaAction || `/business/places/${n.entityId}/edit`,
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
    resolveHref: (n) => n.ctaAction || `/business/places/${n.entityId}`,
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
    resolveHref: (n) => n.ctaAction || `/business/places/${n.entityId}`,
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
    resolveHref: (n) => n.ctaAction || `/business/places/${n.entityId}/edit`,
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
    resolveHref: (n) => n.ctaAction || `/business/places/${n.entityId}`,
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
    resolveHref: (n) => n.ctaAction || `/business/activities/${n.entityId}`,
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
    resolveHref: (n) => n.ctaAction || `/business/activities/${n.entityId}/edit`,
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
    resolveHref: (n) => n.ctaAction || `/business/activities/${n.entityId}`,
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
    resolveHref: (n) => n.ctaAction || `/business/offers/${n.entityId}`,
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
    resolveHref: (n) => n.ctaAction || `/business/offers/${n.entityId}/edit`,
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
    resolveHref: (n) => n.ctaAction || `/business/offers/${n.entityId}`,
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
    resolveHref: () => "/business/dashboard",
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
    resolveHref: (n) => `/admin/business-applications/${n.entityId}`,
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