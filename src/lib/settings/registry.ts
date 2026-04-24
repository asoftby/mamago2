import type {
  SettingsRouteKey,
  SettingsScope,
  SettingsSectionDefinition,
  SettingsSectionGroup,
  SettingsSectionId,
} from "./types";

export const SETTINGS_SECTION_GROUP_LABELS: Record<SettingsSectionGroup, string> = {
  profile: "Профиль",
  organization: "Компания",
  notifications: "Уведомления",
  security: "Безопасность",
  operations: "УВЕДОМЛЕНИЯ",
  privacy: "Конфиденциальность",
};

export const SETTINGS_SECTION_REGISTRY: readonly SettingsSectionDefinition[] = [
  {
    id: "profile",
    title: "Имя и аватар",
    description: "Имя, аватар и основной профиль",
    group: "profile",
    order: 10,
    ownership: "COMMON",
    surfaceScopes: ["USER", "BUSINESS", "ADMIN"],
    routeKey: "profile",
    routeSegment: "profile",
  },
  {
    id: "company",
    title: "Название и реквизиты",
    description: "Данные компании и статус верификации",
    group: "organization",
    order: 20,
    ownership: "BUSINESS",
    surfaceScopes: ["BUSINESS"],
    routeKey: "company",
    routeSegment: "company",
  },
  {
    id: "user-notifications",
    title: "Уведомления",
    description: "Напоминания, рекомендации и важные сообщения",
    group: "notifications",
    order: 30,
    ownership: "USER",
    surfaceScopes: ["USER"],
    routeKey: "notifications",
    routeSegment: "notifications",
  },
  {
    id: "business-notifications",
    title: "Уведомления бизнеса",
    description: "Каналы и статусы для бизнес-кабинета",
    group: "notifications",
    order: 30,
    ownership: "BUSINESS",
    surfaceScopes: ["BUSINESS"],
    routeKey: "notifications",
    routeSegment: "notifications",
  },
  {
    id: "admin-notifications",
    title: "Уведомления",
    description: "Напоминания, рекомендации и важные сообщения",
    group: "notifications",
    order: 30,
    ownership: "ADMIN",
    surfaceScopes: ["ADMIN"],
    routeKey: "notifications",
    routeSegment: "notifications",
  },
  {
    id: "email",
    title: "Email",
    description: "Проверка и подтверждение email",
    group: "security",
    order: 40,
    ownership: "COMMON",
    surfaceScopes: ["USER", "BUSINESS", "ADMIN"],
    routeKey: "email",
    routeSegment: "email",
  },
  {
    id: "password",
    title: "Пароль",
    description: "Смена пароля",
    group: "security",
    order: 50,
    ownership: "COMMON",
    surfaceScopes: ["USER", "BUSINESS", "ADMIN"],
    routeKey: "password",
    routeSegment: "password",
  },
  {
    id: "phone",
    title: "Телефон",
    description: "Привязка и подтверждение номера",
    group: "security",
    order: 60,
    ownership: "COMMON",
    surfaceScopes: ["USER", "BUSINESS", "ADMIN"],
    routeKey: "phone",
    routeSegment: "phone",
  },
  {
    id: "privacy",
    title: "Конфиденциальность",
    description: "Ваши данные, персонализация и удаление аккаунта",
    group: "privacy",
    order: 70,
    ownership: "COMMON",
    surfaceScopes: ["USER", "BUSINESS", "ADMIN"],
    routeKey: "privacy",
    routeSegment: "privacy",
  },
] as const;

export function getSettingsSectionDefinition(
  sectionId: SettingsSectionId,
): SettingsSectionDefinition | undefined {
  return SETTINGS_SECTION_REGISTRY.find((section) => section.id === sectionId);
}

export function getSettingsSectionDefinitionForSurface(
  surfaceScope: SettingsScope,
  sectionId: SettingsSectionId,
): SettingsSectionDefinition | undefined {
  const section = getSettingsSectionDefinition(sectionId);
  if (!section) return undefined;
  if (!section.surfaceScopes.includes(surfaceScope)) return undefined;
  return section;
}

export function getSettingsSectionByRouteKey(
  surfaceScope: SettingsScope,
  routeKey: SettingsRouteKey,
): SettingsSectionDefinition | undefined {
  return SETTINGS_SECTION_REGISTRY.find(
    (section) =>
      section.routeKey === routeKey && section.surfaceScopes.includes(surfaceScope),
  );
}

export function buildSettingsHomeHref(surfaceScope: SettingsScope): string {
  if (surfaceScope === "USER") return "/me/settings";
  if (surfaceScope === "BUSINESS") return "/business/settings";
  if (surfaceScope === "ADMIN") return "/admin/settings";
  return "/me/settings";
}

export function buildSettingsSectionHref(
  surfaceScope: SettingsScope,
  sectionId: SettingsSectionId,
): string {
  const section = getSettingsSectionDefinitionForSurface(surfaceScope, sectionId);
  if (!section?.routeSegment) {
    return buildSettingsHomeHref(surfaceScope);
  }

  return `${buildSettingsHomeHref(surfaceScope)}/${section.routeSegment}`;
}

export function buildSettingsRouteHref(
  surfaceScope: SettingsScope,
  routeKey: SettingsRouteKey,
): string {
  const section = getSettingsSectionByRouteKey(surfaceScope, routeKey);
  if (!section?.routeSegment) {
    return buildSettingsHomeHref(surfaceScope);
  }

  return `${buildSettingsHomeHref(surfaceScope)}/${section.routeSegment}`;
}
