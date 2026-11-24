import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  settingsSectionIconClass,
  settingsSectionIconTileClass,
  type SettingsIconTileTone,
} from "@/components/settings/settingsSectionIconTile";
import { cn } from "@/lib/utils";

export function SettingsLinkRow(props: {
  href: string;
  icon: ElementType;
  label: string;
  description?: ReactNode;
  badge?: ReactNode;
  /** Business cabinet matches profile «A» soft sky; personal stays neutral. */
  iconTone?: SettingsIconTileTone;
}) {
  const Icon = props.icon;
  const iconTone = props.iconTone ?? "neutral";

  return (
    <Link
      href={props.href}
      className="flex items-center gap-4 px-5 py-4 transition-colors group hover:bg-neutral-50"
    >
      <div className={settingsSectionIconTileClass(iconTone, "sm")}>
        <Icon className={settingsSectionIconClass(iconTone)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">
            {props.label}
          </p>
          {props.badge ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                "bg-amber-100 text-amber-800",
              )}
            >
              {props.badge}
            </span>
          ) : null}
        </div>
        {props.description ? (
          <div className="mt-0.5 truncate text-xs text-neutral-400">
            {props.description}
          </div>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500" />
    </Link>
  );
}
