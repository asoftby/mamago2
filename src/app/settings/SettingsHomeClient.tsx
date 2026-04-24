"use client";

import { useMemo } from "react";
import { Bell, Building2, Lock, Mail, Shield, Smartphone, User } from "lucide-react";
import { SettingsLinkRow } from "@/components/settings/SettingsLinkRow";
import { maskPhoneForDisplay } from "@/lib/phone/display";
import { buildSettingsSectionHref } from "@/lib/settings/registry";
import { getVisibleSettingsSectionsByGroup } from "@/lib/settings/visibility";
import type { SettingsContext, SettingsSectionId } from "@/lib/settings/types";

function usernameLabel(context: SettingsContext): string {
  const raw =
    context.viewer.displayName?.trim() ||
    context.viewer.email.split("@")[0] ||
    "user";
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function CardSection(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-neutral-400">
        {props.title}
      </p>
      <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm divide-y divide-neutral-100">
        {props.children}
      </div>
    </section>
  );
}

const SECTION_ICONS: Record<SettingsSectionId, typeof User> = {
  profile: User,
  company: Building2,
  "user-notifications": Bell,
  "business-notifications": Bell,
  "admin-notifications": Bell,
  email: Mail,
  password: Lock,
  phone: Smartphone,
  privacy: Shield,
};

export function SettingsHomeClient({ context }: { context: SettingsContext }) {
  const maskedPhone = useMemo(
    () =>
      context.viewer.phoneE164
        ? maskPhoneForDisplay(context.viewer.phoneE164)
        : "Не указан",
    [context.viewer.phoneE164]
  );

  const visibleGroups = useMemo(
    () => getVisibleSettingsSectionsByGroup(context),
    [context]
  );

  const descriptions: Partial<Record<SettingsSectionId, string>> = {
    profile: usernameLabel(context),
    company: context.businessContext?.name ?? "Компания",
    "user-notifications": "Настройте уведомления, которые хотите получать",
    "business-notifications": "Статусы модерации и каналы бизнеса",
    "admin-notifications": "Напоминания, рекомендации и важные сообщения",
    email: context.viewer.email,
    password: "Сменить пароль",
    phone: maskedPhone,
    privacy: "Управляйте данными и удалением аккаунта",
  };

  return (
    <div className="space-y-6">
      {visibleGroups.map((group) => (
        <CardSection key={group.group} title={group.title}>
          {group.sections.map((section) => {
            const icon = SECTION_ICONS[section.id];

            return (
              <SettingsLinkRow
                key={section.id}
                href={buildSettingsSectionHref(context.surfaceScope, section.id)}
                icon={icon}
                label={section.title}
                description={descriptions[section.id] ?? section.description ?? ""}
                badge={
                  section.id === "email" && !context.viewer.emailVerifiedAt
                    ? "не подтверждён"
                    : undefined
                }
              />
            );
          })}
        </CardSection>
      ))}
      {context.surfaceScope === "BUSINESS" ? (
        <CardSection title="Аккаунт">
          <SettingsLinkRow
            href="/settings/account?from=business"
            icon={Shield}
            label="Аккаунт и безопасность"
            description="Имя, вход, пароль, телефон и конфиденциальность"
          />
        </CardSection>
      ) : null}
    </div>
  );
}
