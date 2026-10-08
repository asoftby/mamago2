"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type AdminFilterTabItem = {
  value: string;
  label: string;
  count?: number;
  href?: string;
};

type AdminFilterTabsProps = {
  items: AdminFilterTabItem[];
  value: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
};

function tabClassName(active: boolean) {
  return cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active
      ? "bg-stone-900 text-white"
      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
  );
}

function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
        active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600",
      )}
    >
      {count}
    </span>
  );
}

export function AdminFilterTabs({
  items,
  value,
  onValueChange,
  ariaLabel = "Фильтр по статусу",
  className,
}: AdminFilterTabsProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1 no-scrollbar",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const content = (
          <>
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <CountBadge count={item.count} active={active} />
            ) : null}
          </>
        );

        if (item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={tabClassName(active)}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange?.(item.value)}
            className={tabClassName(active)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
