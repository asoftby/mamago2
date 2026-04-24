import type {
  NotificationAudience,
  NotificationChannel,
  NotificationType,
} from "@prisma/client";

export type NotificationSettingsSurface = "USER" | "BUSINESS" | "ADMIN";

export type NotificationSettingsGroupId =
  | "user-important"
  | "user-for-you"
  | "business-places"
  | "business-updates"
  | "business-content"
  | "business-verification"
  | "business-applications"
  | "admin-operations";

export type ChannelDefaults = {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
};

export type NotificationSettingsRow = {
  notificationType: NotificationType;
  label: string;
  description?: string;
  audience: NotificationAudience;
  channels: Record<NotificationChannel, boolean>;
  defaultChannels: Record<NotificationChannel, boolean>;
  isOverridden: boolean;
};

export type NotificationSettingsGroup = {
  id: NotificationSettingsGroupId;
  title: string;
  description?: string;
  order: number;
  surface: NotificationSettingsSurface;
  rows: NotificationSettingsRow[];
};

export type NotificationSettingsSurfaceData = {
  surface: NotificationSettingsSurface;
  telegramConnected: boolean;
  telegramUsername?: string;
  rows: NotificationSettingsRow[];
  groups: NotificationSettingsGroup[];
};

type NotificationSettingsDefaultKind =
  | "USER_SECURITY"
  | "USER_REMINDERS"
  | "USER_RECOMMENDATIONS"
  | "USER_NEWS"
  | "BUSINESS_DECISION"
  | "BUSINESS_ACTION"
  | "ADMIN_QUEUE";

type NotificationSettingsGroupDefinition = {
  id: NotificationSettingsGroupId;
  surface: NotificationSettingsSurface;
  title: string;
  description?: string;
  order: number;
};

type NotificationSettingsTypeDefinition = {
  type: NotificationType;
  label: string;
  description: string;
  audience: NotificationAudience;
  surface: NotificationSettingsSurface;
  groupId: NotificationSettingsGroupId;
  order: number;
  defaultKind: NotificationSettingsDefaultKind;
};

const CHANNEL_DEFAULT_PRESETS: Record<NotificationSettingsDefaultKind, ChannelDefaults> = {
  // USER surface — new model
  USER_SECURITY:         { inApp: true,  email: true,  telegram: false },
  USER_REMINDERS:        { inApp: true,  email: false, telegram: true  },
  USER_RECOMMENDATIONS:  { inApp: true,  email: false, telegram: true  },
  USER_NEWS:             { inApp: false, email: false, telegram: false },
  // BUSINESS / ADMIN — unchanged
  BUSINESS_DECISION:     { inApp: true,  email: true,  telegram: false },
  BUSINESS_ACTION:       { inApp: true,  email: true,  telegram: false },
  ADMIN_QUEUE:           { inApp: true,  email: true,  telegram: false },
};

const SILENT_CHANNELS: ChannelDefaults = {
  inApp: false,
  email: false,
  telegram: false,
};

const NOTIFICATION_SETTINGS_GROUP_DEFINITIONS: readonly NotificationSettingsGroupDefinition[] = [
  // USER surface — compact single-group matrix
  {
    id: "user-important",
    surface: "USER",
    title: "Уведомления",
    description: "Выберите, какие уведомления и в какой канал отправлять.",
    order: 10,
  },
  // BUSINESS surface — unchanged
  {
    id: "business-places",
    surface: "BUSINESS",
    title: "Статус места",
    description: "Публикация, правки и отклонения карточек мест",
    order: 10,
  },
  {
    id: "business-updates",
    surface: "BUSINESS",
    title: "Изменения места",
    description: "Ответы по обновлениям уже опубликованных мест",
    order: 20,
  },
  {
    id: "business-content",
    surface: "BUSINESS",
    title: "События и предложения",
    description: "Модерация событий и спецпредложений",
    order: 30,
  },
  {
    id: "business-verification",
    surface: "BUSINESS",
    title: "Верификация бизнеса",
    description: "Статусы проверки компании и запросы на доработку",
    order: 40,
  },
  {
    id: "business-applications",
    surface: "BUSINESS",
    title: "Заявки",
    description: "Новые входящие заявки в бизнес-кабинете",
    order: 50,
  },
  // ADMIN surface — unchanged
  {
    id: "admin-operations",
    surface: "ADMIN",
    title: "Уведомления",
    description: "Напоминания, рекомендации и важные сообщения",
    order: 10,
  },
] as const;

const NOTIFICATION_SETTINGS_TYPE_DEFINITIONS: readonly NotificationSettingsTypeDefinition[] = [
  // ── USER surface — 4 product categories ──────────────────────────────────
  //
  // Storage aliases (Prisma enum values reused as product category keys):
  //   SYSTEM         = "Аккаунт и безопасность"  — account security events
  //   REMINDER       = "Напоминания"              — plan/event reminders
  //   RECOMMENDATION = "Рекомендации для вас"     — personalised discovery
  //   NEWS           = "Новости mamaGo"           — service news & announcements
  //
  // Legacy types WELCOME and ANNOUNCEMENT are NOT in this registry.
  // They exist only as compatibility input — see userNotificationEvents.ts.
  {
    type: "SYSTEM",
    label: "Системные",
    description: "Безопасность и важные изменения",
    audience: "USER",
    surface: "USER",
    groupId: "user-important",
    order: 10,
    defaultKind: "USER_SECURITY",
  },
  {
    type: "REMINDER",
    label: "Напоминания",
    description: "О запланированных событиях",
    audience: "USER",
    surface: "USER",
    groupId: "user-important",
    order: 20,
    defaultKind: "USER_REMINDERS",
  },
  {
    type: "RECOMMENDATION",
    label: "Рекомендации",
    description: "Подборки и идеи для вас и детей",
    audience: "USER",
    surface: "USER",
    groupId: "user-important",
    order: 30,
    defaultKind: "USER_RECOMMENDATIONS",
  },
  {
    type: "NEWS",
    label: "Новое и интересное",
    description: "Новые события, места и предложения",
    audience: "USER",
    surface: "USER",
    groupId: "user-important",
    order: 40,
    defaultKind: "USER_NEWS",
  },
  // ── BUSINESS surface — unchanged ─────────────────────────────────────────
  {
    type: "PLACE_APPROVED",
    label: "Место опубликовано",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-places",
    order: 10,
    defaultKind: "BUSINESS_DECISION",
  },
  {
    type: "PLACE_NEEDS_CHANGES",
    label: "Место требует правок",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-places",
    order: 20,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "PLACE_REJECTED",
    label: "Место отклонено",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-places",
    order: 30,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "PLACE_UPDATE_APPROVED",
    label: "Изменения места опубликованы",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-updates",
    order: 10,
    defaultKind: "BUSINESS_DECISION",
  },
  {
    type: "PLACE_UPDATE_NEEDS_REVISION",
    label: "Изменения места требуют правок",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-updates",
    order: 20,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "PLACE_UPDATE_REJECTED",
    label: "Изменения места отклонены",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-updates",
    order: 30,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "ACTIVITY_APPROVED",
    label: "Событие опубликовано",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-content",
    order: 10,
    defaultKind: "BUSINESS_DECISION",
  },
  {
    type: "ACTIVITY_NEEDS_CHANGES",
    label: "Событие требует правок",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-content",
    order: 20,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "ACTIVITY_REJECTED",
    label: "Событие отклонено",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-content",
    order: 30,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "OFFER_APPROVED",
    label: "Предложение опубликовано",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-content",
    order: 40,
    defaultKind: "BUSINESS_DECISION",
  },
  {
    type: "OFFER_NEEDS_CHANGES",
    label: "Предложение требует правок",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-content",
    order: 50,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "OFFER_REJECTED",
    label: "Предложение отклонено",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-content",
    order: 60,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "BUSINESS_VERIFIED",
    label: "Верификация пройдена",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-verification",
    order: 10,
    defaultKind: "BUSINESS_DECISION",
  },
  {
    type: "BUSINESS_REJECTED",
    label: "Верификация отклонена",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-verification",
    order: 20,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "BUSINESS_NEEDS_INFO",
    label: "Требуется дополнительная информация",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-verification",
    order: 30,
    defaultKind: "BUSINESS_ACTION",
  },
  {
    type: "BUSINESS_APPLICATION_CREATED",
    label: "Новая заявка",
    description: "",
    audience: "BUSINESS",
    surface: "BUSINESS",
    groupId: "business-applications",
    order: 10,
    defaultKind: "BUSINESS_ACTION",
  },
  // ── ADMIN surface — unchanged ─────────────────────────────────────────────
  {
    type: "ADMIN_MODERATION_ITEM_CREATED",
    label: "Новый объект на модерации",
    description: "",
    audience: "ADMIN",
    surface: "ADMIN",
    groupId: "admin-operations",
    order: 10,
    defaultKind: "ADMIN_QUEUE",
  },
] as const;

type LegacyNotificationRole = "USER" | "BUSINESS_OWNER" | "MODERATOR" | "ADMIN";

const LEGACY_ROLE_SURFACE_ACCESS: Record<
  LegacyNotificationRole,
  readonly NotificationSettingsSurface[]
> = {
  USER: ["USER"],
  BUSINESS_OWNER: ["USER", "BUSINESS"],
  MODERATOR: ["USER"],
  ADMIN: ["USER", "ADMIN"],
};

function toChannelRecord(defaults: ChannelDefaults): Record<NotificationChannel, boolean> {
  return {
    IN_APP: defaults.inApp,
    EMAIL: defaults.email,
    TELEGRAM: defaults.telegram,
  };
}

export const ALL_NOTIFICATION_SETTINGS_TYPES = NOTIFICATION_SETTINGS_TYPE_DEFINITIONS.map(
  (definition) => definition.type,
);

/**
 * The 4 active USER-surface notification types.
 * Only these types are valid for USER preference writes and settings UI.
 * WELCOME and ANNOUNCEMENT are legacy-only — they are NOT in this set.
 */
export const ACTIVE_USER_NOTIFICATION_TYPES = new Set<NotificationType>(
  NOTIFICATION_SETTINGS_TYPE_DEFINITIONS
    .filter((d) => d.surface === "USER")
    .map((d) => d.type),
);

export function getNotificationSettingsTypesForSurface(
  surface: NotificationSettingsSurface,
): NotificationType[] {
  return NOTIFICATION_SETTINGS_TYPE_DEFINITIONS
    .filter((definition) => definition.surface === surface)
    .sort((left, right) => left.order - right.order)
    .map((definition) => definition.type);
}

export function getNotificationSettingsTypeDefinitions(
  surface: NotificationSettingsSurface,
): NotificationSettingsTypeDefinition[] {
  return NOTIFICATION_SETTINGS_TYPE_DEFINITIONS
    .filter((definition) => definition.surface === surface)
    .sort((left, right) => left.order - right.order);
}

export function getNotificationSettingsGroupDefinitions(
  surface: NotificationSettingsSurface,
): NotificationSettingsGroupDefinition[] {
  return NOTIFICATION_SETTINGS_GROUP_DEFINITIONS
    .filter((group) => group.surface === surface)
    .sort((left, right) => left.order - right.order);
}

export function getNotificationSettingsTypeDefinition(
  notificationType: NotificationType,
): NotificationSettingsTypeDefinition | undefined {
  return NOTIFICATION_SETTINGS_TYPE_DEFINITIONS.find(
    (definition) => definition.type === notificationType,
  );
}

export function getNotificationSettingsLabel(
  notificationType: NotificationType,
): string {
  return getNotificationSettingsTypeDefinition(notificationType)?.label ?? notificationType;
}

export function resolveNotificationSettingsSurfaceForType(
  notificationType: NotificationType,
): NotificationSettingsSurface {
  return getNotificationSettingsTypeDefinition(notificationType)?.surface ?? "USER";
}

export function resolveNotificationAudienceForType(
  notificationType: NotificationType,
): NotificationAudience {
  return getNotificationSettingsTypeDefinition(notificationType)?.audience ?? "USER";
}

export function isNotificationTypeSupportedOnSurface(
  surface: NotificationSettingsSurface,
  notificationType: NotificationType,
): boolean {
  return resolveNotificationSettingsSurfaceForType(notificationType) === surface;
}

export function getNotificationSurfaceDefaults(
  surface: NotificationSettingsSurface,
  notificationType: NotificationType,
): ChannelDefaults {
  const definition = getNotificationSettingsTypeDefinition(notificationType);

  if (!definition || definition.surface !== surface) {
    return SILENT_CHANNELS;
  }

  return CHANNEL_DEFAULT_PRESETS[definition.defaultKind];
}

export function getLegacyNotificationDefaults(
  role: string,
  notificationType: NotificationType,
): ChannelDefaults {
  const resolvedRole: LegacyNotificationRole =
    role === "BUSINESS_OWNER" || role === "MODERATOR" || role === "ADMIN"
      ? role
      : "USER";
  const surface = resolveNotificationSettingsSurfaceForType(notificationType);

  if (!LEGACY_ROLE_SURFACE_ACCESS[resolvedRole].includes(surface)) {
    return SILENT_CHANNELS;
  }

  return getNotificationSurfaceDefaults(surface, notificationType);
}

export function buildLegacyNotificationDefaultsMap(
  role: string,
): Record<NotificationType, ChannelDefaults> {
  return ALL_NOTIFICATION_SETTINGS_TYPES.reduce(
    (accumulator, notificationType) => {
      accumulator[notificationType] = getLegacyNotificationDefaults(role, notificationType);
      return accumulator;
    },
    {} as Record<NotificationType, ChannelDefaults>,
  );
}

export function buildEmptyNotificationSettingsSurfaceData(
  surface: NotificationSettingsSurface,
): NotificationSettingsSurfaceData {
  const rows = getNotificationSettingsTypeDefinitions(surface).map((definition) => {
    const defaults = getNotificationSurfaceDefaults(surface, definition.type);

    return {
      notificationType: definition.type,
      label: definition.label,
      audience: definition.audience,
      channels: toChannelRecord(defaults),
      defaultChannels: toChannelRecord(defaults),
      isOverridden: false,
    };
  });

  const rowsByType = new Map(rows.map((row) => [row.notificationType, row]));
  const groups = getNotificationSettingsGroupDefinitions(surface)
    .map((group) => ({
      ...group,
      rows: getNotificationSettingsTypeDefinitions(surface)
        .filter((definition) => definition.groupId === group.id)
        .map((definition) => rowsByType.get(definition.type))
        .filter((row): row is NotificationSettingsRow => Boolean(row)),
    }))
    .filter((group) => group.rows.length > 0);

  return {
    surface,
    telegramConnected: false,
    rows,
    groups,
  };
}
