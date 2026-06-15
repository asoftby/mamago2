"use client";

import { cn } from "@/lib/utils";

export type RoutesFilter = "ALL" | "DRAFT" | "PUBLISHED";

type TabItem = {
  value: RoutesFilter;
  label: string;
  count: number;
};

type RoutesTabsProps = {
  value: RoutesFilter;
  items: TabItem[];
  onChange: (value: RoutesFilter) => void;
};

export function RoutesTabs({ value, items, onChange }: RoutesTabsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2.5 pb-1">
        {items.map((item) => {
          const active = item.value === value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                active
                  ? "border-[#141210] bg-[#141210] text-white shadow-[0_10px_24px_rgba(20,18,16,0.14)]"
                  : "border-[rgba(20,18,16,0.1)] bg-white text-[rgba(20,18,16,0.7)] hover:border-[rgba(20,18,16,0.2)] hover:bg-brand-soft",
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px]",
                  active
                    ? "bg-white/12 text-white"
                    : "bg-[rgba(20,18,16,0.05)] text-[rgba(20,18,16,0.55)]",
                )}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
