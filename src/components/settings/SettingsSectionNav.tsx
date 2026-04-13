import Link from "next/link";
import { cn } from "@/lib/utils";
import { getVisibleSettingsSectionsByGroup } from "@/lib/settings/visibility";
import type { SettingsContext, SettingsSectionId } from "@/lib/settings/types";

export function SettingsSectionNav(props: {
  context: SettingsContext;
  currentSectionId?: SettingsSectionId | "home";
}) {
  const groups = getVisibleSettingsSectionsByGroup(props.context);

  if (!groups.length) {
    return null;
  }

  return (
    <nav aria-label="Разделы настроек" className="space-y-4">
      {groups.map((group) => (
        <section key={group.group} className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-400">
            {group.title}
          </p>
          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
            {group.sections.map((section, index) => {
              const isActive = props.currentSectionId === section.id;

              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors",
                    index > 0 && "border-t border-neutral-100",
                    isActive
                      ? "bg-neutral-50 font-medium text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{section.title}</span>
                  <span className="text-xs text-neutral-400">{section.description}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
