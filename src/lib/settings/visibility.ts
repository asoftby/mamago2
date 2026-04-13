import {
  SETTINGS_SECTION_GROUP_LABELS,
  SETTINGS_SECTION_REGISTRY,
  buildSettingsSectionHref,
} from "./registry";
import type { SettingsContext, SettingsSectionDefinition, SettingsSectionGroup } from "./types";

export function getVisibleSettingsSections(
  context: SettingsContext,
): SettingsSectionDefinition[] {
  return SETTINGS_SECTION_REGISTRY
    .filter((section) => section.surfaceScopes.includes(context.surfaceScope))
    .filter((section) => section.isVisible?.(context) ?? true)
    .sort((a, b) => a.order - b.order);
}

export function getVisibleSettingsSectionsByGroup(context: SettingsContext): Array<{
  group: SettingsSectionGroup;
  title: string;
  sections: Array<SettingsSectionDefinition & { href: string }>;
}> {
  const sections = getVisibleSettingsSections(context);
  const byGroup = new Map<SettingsSectionGroup, Array<SettingsSectionDefinition & { href: string }>>();

  for (const section of sections) {
    const href = buildSettingsSectionHref(context.surfaceScope, section.id);
    const existing = byGroup.get(section.group) ?? [];
    existing.push({ ...section, href });
    byGroup.set(section.group, existing);
  }

  return Array.from(byGroup.entries()).map(([group, groupedSections]) => ({
    group,
    title: SETTINGS_SECTION_GROUP_LABELS[group],
    sections: groupedSections,
  }));
}
