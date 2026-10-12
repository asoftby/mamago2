"use client";

import { Lock, Mail, Shield, Smartphone, User } from "lucide-react";
import { SettingsLinkRow } from "@/components/settings/SettingsLinkRow";
import { maskPhoneForDisplay } from "@/lib/phone/display";
import { buildSettingsHomeHref } from "@/lib/settings/registry";
import type { SettingsContext } from "@/lib/settings/types";

/** «Аккаунт и безопасность» в кабинете бизнеса: список личных разделов аккаунта. */
export function BusinessAccountHub({ context }: { context: SettingsContext }) {
  const base = buildSettingsHomeHref("BUSINESS");
  const name =
    context.viewer.displayName?.trim() || context.viewer.email.split("@")[0] || "Не указано";
  const phone = context.viewer.phoneE164
    ? maskPhoneForDisplay(context.viewer.phoneE164)
    : "Не указан";

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm divide-y divide-neutral-100">
      <SettingsLinkRow href={`${base}/profile`} icon={User} label="Имя и аватар" description={name} />
      <SettingsLinkRow
        href={`${base}/email`}
        icon={Mail}
        label="Email"
        description={context.viewer.email}
        badge={context.viewer.emailVerifiedAt ? undefined : "не подтверждён"}
      />
      <SettingsLinkRow href={`${base}/password`} icon={Lock} label="Пароль" description="Сменить пароль" />
      <SettingsLinkRow href={`${base}/phone`} icon={Smartphone} label="Телефон" description={phone} />
      <SettingsLinkRow
        href={`${base}/privacy`}
        icon={Shield}
        label="Конфиденциальность"
        description="Управляйте данными и удалением аккаунта"
      />
    </div>
  );
}
