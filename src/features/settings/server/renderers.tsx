/**
 * Canonical server renderers for the shared settings experience.
 *
 * Role-specific route entrypoints (`/me/settings`, `/business/settings`,
 * `/admin/settings`) should import from this module. Compatibility redirects
 * under `/settings/*` intentionally do not own rendering anymore.
 */

import { Building2, FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { ProfileSettingsClient } from "@/app/(public)/me/settings/profile/ProfileSettingsClient";
import { NotificationPreferencesClient } from "@/app/(public)/me/settings/notifications/NotificationPreferencesClient";
import { BusinessNotificationSettingsClient } from "@/app/business/(protected)/settings/notifications/BusinessNotificationSettingsClient";
import { SettingsHomeClient } from "@/app/settings/SettingsHomeClient";
import { EmailSettingsClient } from "@/app/settings/email/EmailSettingsClient";
import { ChangePasswordForm } from "@/app/settings/password/ChangePasswordForm";
import { PhoneSettingsClient } from "@/app/settings/phone/PhoneSettingsClient";
import { PrivacySettingsClient } from "@/app/settings/privacy/PrivacySettingsClient";
import { NotificationSettingsTable } from "@/components/business/notifications/NotificationSettingsTable";
import { SettingsScaffold } from "@/components/settings/SettingsScaffold";
import { buildSettingsHomeHref } from "@/lib/settings/registry";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";
import type { SettingsScope } from "@/lib/settings/types";
import { getNotificationSettingsSurfaceData } from "@/server/services/notificationSettings.service";

function CompanyInfoRow(props: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-neutral-700">{props.label}</p>
      <p className="text-sm text-neutral-900">{props.value}</p>
    </div>
  );
}

export async function renderSettingsPage(surfaceScope: SettingsScope = "USER") {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });

  return (
    <SettingsScaffold
      context={context}
      title="Настройки"
      currentSectionId="home"
    >
      <SettingsHomeClient context={context} />
    </SettingsScaffold>
  );
}

export async function renderProfileSettingsPage(surfaceScope: SettingsScope = "USER") {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });

  const initial = (
    context.viewer.displayName ?? context.viewer.email?.split("@")[0] ?? "?"
  ).charAt(0);

  return (
    <SettingsScaffold
      context={context}
      title="Имя и аватар"
      maxWidthClassName="max-w-md"
      currentSectionId="profile"
    >
      <ProfileSettingsClient
        initial={initial}
        avatarUrl={context.viewer.avatarUrl}
        displayName={context.viewer.displayName}
      />
    </SettingsScaffold>
  );
}

export async function renderEmailSettingsPage(surfaceScope: SettingsScope = "USER") {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });

  return (
    <SettingsScaffold context={context} title="Email" currentSectionId="email">
      <EmailSettingsClient />
    </SettingsScaffold>
  );
}

export async function renderPasswordSettingsPage(surfaceScope: SettingsScope = "USER") {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });

  return (
    <SettingsScaffold
      context={context}
      title="Сменить пароль"
      currentSectionId="password"
    >
      <ChangePasswordForm />
    </SettingsScaffold>
  );
}

export async function renderPhoneSettingsPage(surfaceScope: SettingsScope = "USER") {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });

  return (
    <SettingsScaffold context={context} title="Телефон" currentSectionId="phone">
      <PhoneSettingsClient
        initialPhoneE164={context.viewer.phoneE164}
        initialPhoneVerifiedAt={context.viewer.phoneVerifiedAt}
        homeHref={buildSettingsHomeHref(context.surfaceScope)}
      />
    </SettingsScaffold>
  );
}

export async function renderPrivacySettingsPage(surfaceScope: SettingsScope = "USER") {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });

  return (
    <SettingsScaffold
      context={context}
      title="Конфиденциальность"
      currentSectionId="privacy"
    >
      <PrivacySettingsClient />
    </SettingsScaffold>
  );
}

export async function renderCompanySettingsPage(surfaceScope: SettingsScope = "USER") {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });
  const business = context.businessContext;

  if (!business) {
    redirect(buildSettingsHomeHref(context.surfaceScope));
  }

  return (
    <SettingsScaffold context={context} title="Компания" currentSectionId="company">
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
              <FileText className="h-4 w-4 text-neutral-500" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-neutral-900">
                Статус компании
              </p>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                Подтвержден
              </span>
              <p className="text-sm text-neutral-600">
                Текущий статус: {business.verificationStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
              <Building2 className="h-4 w-4 text-neutral-500" />
            </div>
            <div className="flex-1 space-y-5">
              <CompanyInfoRow label="Название компании" value={business.name} />
              {business.legalName ? (
                <CompanyInfoRow label="Юридическое название" value={business.legalName} />
              ) : null}
              {business.unp ? (
                <CompanyInfoRow label="УНП" value={business.unp} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </SettingsScaffold>
  );
}

export async function renderNotificationSettingsPage(
  surfaceScope: SettingsScope = "USER",
) {
  const context = await requireSettingsContext({ requestedScope: surfaceScope });
  const data = await getNotificationSettingsSurfaceData(
    context.viewer.id,
    surfaceScope,
  );

  if (surfaceScope === "ADMIN") {
    return (
      <SettingsScaffold
        context={context}
        title="Уведомления"
        maxWidthClassName="max-w-5xl"
        currentSectionId="admin-notifications"
      >
        <NotificationSettingsTable
          surface="ADMIN"
          initialData={data}
          pageTitle="Уведомления"
          pageDescription="Напоминания, рекомендации и важные сообщения."
        />
      </SettingsScaffold>
    );
  }

  return (
    <SettingsScaffold
      context={context}
      title={
        surfaceScope === "BUSINESS"
          ? "Уведомления бизнеса"
          : "Уведомления"
      }
      maxWidthClassName="max-w-5xl"
      currentSectionId={
        surfaceScope === "BUSINESS"
          ? "business-notifications"
          : "user-notifications"
      }
    >
      {surfaceScope === "BUSINESS" ? (
        <BusinessNotificationSettingsClient initialData={data} />
      ) : (
        <NotificationPreferencesClient initialData={data} />
      )}
    </SettingsScaffold>
  );
}
