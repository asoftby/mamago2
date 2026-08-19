"use client";

import { cn } from "@/lib/utils";
import type { Filter } from "../types";
import { C } from "../theme";

type TabItem = {
  value: Filter;
  label: string;
  count: number;
};

type IdeasTabsProps = {
  value: Filter;
  items: TabItem[];
  onChange: (value: Filter) => void;
};

export function IdeasTabs({ value, items, onChange }: IdeasTabsProps) {
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
                "inline-flex h-[42px] items-center gap-2 rounded-full border px-[18px] text-sm font-medium transition-all",
              )}
              style={
                active
                  ? { borderColor: C.ink, background: C.ink, color: C.paper }
                  : { borderColor: C.line2, background: "transparent", color: C.ink2 }
              }
            >
              <span>{item.label}</span>
              <span
                className="font-mono text-[11px] tracking-[0.04em]"
                style={{ color: active ? "rgba(250,247,241,.55)" : C.ink3 }}
              >
                {String(item.count).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
