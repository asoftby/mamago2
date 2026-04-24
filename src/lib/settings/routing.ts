import type {
  SettingsContext,
  SettingsRouteKey,
  SettingsScope,
  SettingsSectionId,
} from "./types";
import {
  buildSettingsHomeHref,
  buildSettingsRouteHref,
  buildSettingsSectionHref,
  getSettingsSectionByRouteKey,
} from "./registry";

function routeKeyFromSectionId(sectionId: SettingsSectionId): SettingsRouteKey {
  if (
    sectionId === "user-notifications" ||
    sectionId === "business-notifications" ||
    sectionId === "admin-notifications"
  ) {
    return "notifications";
  }

  return sectionId;
}

export function resolveCanonicalSettingsScope(
  context: SettingsContext,
  routeKey?: SettingsRouteKey,
): SettingsScope {
  if (context.permissions.canAccessAdminSettings) {
    return "ADMIN";
  }

  if (routeKey === "company") {
    return "BUSINESS";
  }

  return "USER";
}

export function buildCanonicalSettingsHrefByRoute(
  context: SettingsContext,
  routeKey?: SettingsRouteKey,
): string {
  const scope = resolveCanonicalSettingsScope(context, routeKey);
  if (!routeKey) {
    return buildSettingsHomeHref(scope);
  }

  const canonicalSection = getSettingsSectionByRouteKey(scope, routeKey);
  if (!canonicalSection) {
    return buildSettingsHomeHref(scope);
  }

  return buildSettingsRouteHref(scope, routeKey);
}

export function buildCanonicalSettingsHref(
  context: SettingsContext,
  sectionId?: SettingsSectionId,
): string {
  if (!sectionId) {
    return buildCanonicalSettingsHrefByRoute(context);
  }

  const routeKey = routeKeyFromSectionId(sectionId);
  const scope = resolveCanonicalSettingsScope(context, routeKey);

  const canonicalSection = getSettingsSectionByRouteKey(scope, routeKey);
  if (!canonicalSection) {
    return buildSettingsHomeHref(scope);
  }

  return buildSettingsSectionHref(scope, canonicalSection.id);
}
