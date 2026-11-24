import type { ReactNode } from "react";
import { buildSettingsHomeHref } from "@/lib/settings/registry";
import type { SettingsContext, SettingsSectionId } from "@/lib/settings/types";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { SettingsPageLayout } from "./SettingsPageLayout";
import { SettingsSectionNav } from "./SettingsSectionNav";

export function SettingsScaffold(props: {
  context: SettingsContext;
  title: string;
  children: ReactNode;
  maxWidthClassName?: string;
  currentSectionId?: SettingsSectionId | "home";
  showSectionNav?: boolean;
}) {
  const homeHref = buildSettingsHomeHref(props.context.surfaceScope);
  const sections = (
    <div className="space-y-6">
      {props.showSectionNav ? (
        <SettingsSectionNav
          context={props.context}
          currentSectionId={props.currentSectionId}
        />
      ) : null}
      {props.children}
    </div>
  );

  // Business settings belong to BusinessShell, not the public full-height
  // SettingsPageLayout. Back + crumbs live once in BusinessCabinetNav (shell);
  // do not render a second control here.
  if (props.context.surfaceScope === "BUSINESS") {
    return (
      <div className="space-y-6">
        <BusinessSectionHeader
          eyebrow="КАБИНЕТ"
          title={props.title}
          description={
            props.currentSectionId === "home"
              ? "Управление параметрами организации, уведомлениями и безопасностью."
              : "Параметры и безопасность вашего бизнес-аккаунта."
          }
        />
        <div className={`mx-auto ${props.maxWidthClassName ?? "max-w-2xl"}`}>
          {sections}
        </div>
      </div>
    );
  }

  return (
    <SettingsPageLayout
      title={props.title}
      maxWidthClassName={props.maxWidthClassName}
      backHref={props.currentSectionId === "home" ? (props.context.surfaceScope === "ADMIN" ? "/admin" : null) : homeHref}
      backLabel={props.currentSectionId === "home" && props.context.surfaceScope === "ADMIN" ? "Админка" : "К настройкам"}
    >
      {sections}
    </SettingsPageLayout>
  );
}
