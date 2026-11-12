import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { buildSettingsHomeHref } from "@/lib/settings/registry";
import type { SettingsContext, SettingsSectionId } from "@/lib/settings/types";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { HistoryBackButton } from "@/components/navigation/HistoryBackButton";
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
  // SettingsPageLayout. Preserve the shared settings functionality and
  // back navigation while adopting the same header as /business/bookings.
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
        <div className={props.maxWidthClassName ?? "max-w-2xl"}>
          {props.currentSectionId !== "home" ? (
            <HistoryBackButton
              fallbackHref={homeHref}
              className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              К настройкам
            </HistoryBackButton>
          ) : null}
          {sections}
        </div>
      </div>
    );
  }

  return (
    <SettingsPageLayout
      title={props.title}
      maxWidthClassName={props.maxWidthClassName}
      fallbackHref={homeHref}
    >
      {sections}
    </SettingsPageLayout>
  );
}
