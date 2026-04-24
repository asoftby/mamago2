import type { BusinessMemberRole, Role } from "@prisma/client";

export type SettingsScope = "USER" | "BUSINESS" | "ADMIN";

export type SettingsSectionId =
  | "profile"
  | "company"
  | "user-notifications"
  | "business-notifications"
  | "admin-notifications"
  | "email"
  | "password"
  | "phone"
  | "privacy";

export type SettingsRouteKey =
  | "profile"
  | "company"
  | "notifications"
  | "email"
  | "password"
  | "phone"
  | "privacy";

export type SettingsSectionOwnership = "COMMON" | "USER" | "BUSINESS" | "ADMIN";

export type SettingsSectionGroup =
  | "profile"
  | "organization"
  | "notifications"
  | "security"
  | "operations"
  | "privacy";

export interface SettingsViewer {
  id: string;
  email: string;
  role: Role;
  displayName: string | null;
  avatarUrl: string | null;
  phoneE164: string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
}

export interface SettingsViewerPermissions {
  canAccessUserSettings: boolean;
  canAccessBusinessSettings: boolean;
  canAccessAdminSettings: boolean;
  canManageBusinessSettings: boolean;
}

export interface SettingsBusinessContext {
  id: string;
  name: string;
  legalName: string | null;
  unp: string | null;
  verificationStatus: string | null;
  membershipRole: BusinessMemberRole | null;
  accessMode: "member" | "legacy_owner";
}

export interface SettingsContext {
  viewer: SettingsViewer;
  surfaceScope: SettingsScope;
  requestedScope: SettingsScope;
  permissions: SettingsViewerPermissions;
  businessContext: SettingsBusinessContext | null;
}

export interface SettingsSectionDefinition {
  id: SettingsSectionId;
  title: string;
  description?: string;
  group: SettingsSectionGroup;
  order: number;
  ownership: SettingsSectionOwnership;
  surfaceScopes: readonly SettingsScope[];
  routeKey: SettingsRouteKey;
  routeSegment?: string;
  isVisible?: (context: SettingsContext) => boolean;
}
