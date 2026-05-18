import { redirect } from "next/navigation";
import { BusinessMemberRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessMembership } from "@/server/permissions/business-permissions";
import type { SettingsBusinessContext, SettingsContext, SettingsScope } from "./types";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";

type ResolveSettingsContextOptions = {
  requestedScope: SettingsScope;
};

async function resolveBusinessContext(userId: string): Promise<SettingsBusinessContext | null> {
  const business = await getMyBusiness(userId);
  if (!business) return null;

  const membership = await getBusinessMembership(userId, business.id);

  return {
    id: business.id,
    name: business.name,
    legalName: business.legalName ?? null,
    unp: business.unp ?? null,
    verificationStatus: business.verificationStatus ?? null,
    membershipRole: membership?.role ?? null,
    accessMode: membership ? "member" : "legacy_owner",
  };
}

export async function resolveSettingsContext(
  options: ResolveSettingsContextOptions,
): Promise<SettingsContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const businessContext =
    user.role === "ADMIN" || user.role === "MODERATOR"
      ? null
      : await resolveBusinessContext(user.id);

  const hasBusinessAccess =
    businessContext !== null &&
    (businessContext.accessMode === "legacy_owner" ||
      businessContext.membershipRole === BusinessMemberRole.OWNER ||
      businessContext.membershipRole === BusinessMemberRole.MANAGER);

  const tg = await getActiveTelegramConnectionForCurrentEnvironment(user.id);

  return {
    viewer: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName ?? null,
      avatarUrl: user.avatarUrl ?? null,
      phoneE164: user.phoneE164 ?? null,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      telegramLinked: tg?.isActive ?? false,
      telegramUsername: tg?.telegramUsername ?? null,
    },
    surfaceScope: options.requestedScope,
    requestedScope: options.requestedScope,
    permissions: {
      canAccessUserSettings: true,
      canAccessBusinessSettings: hasBusinessAccess,
      canAccessAdminSettings: user.role === "ADMIN" || user.role === "MODERATOR",
      canManageBusinessSettings: hasBusinessAccess,
    },
    businessContext,
  };
}

export async function requireSettingsContext(
  options: ResolveSettingsContextOptions,
): Promise<SettingsContext> {
  const context = await resolveSettingsContext(options);
  if (context) {
    return context;
  }

  const routing = await getCurrentRequestRoutingContext();
  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "public",
      targetPath: "/login",
      ...routing,
    }),
  );
}
