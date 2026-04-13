import type { ReactNode } from "react";
import { buildSettingsHomeHref } from "@/lib/settings/registry";
import type { SettingsContext, SettingsSectionId } from "@/lib/settings/types";
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
  return (
    <SettingsPageLayout
      title={props.title}
      maxWidthClassName={props.maxWidthClassName}
      fallbackHref={buildSettingsHomeHref(props.context.surfaceScope)}
    >
      <div className="space-y-6">
        {props.showSectionNav ? (
          <SettingsSectionNav
            context={props.context}
            currentSectionId={props.currentSectionId}
          />
        ) : null}
        {props.children}
      </div>
    </SettingsPageLayout>
  );
}
