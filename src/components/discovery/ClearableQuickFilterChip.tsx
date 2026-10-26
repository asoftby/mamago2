"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A selected quick filter has two independent actions: open its picker and
 * remove its value. Keep the buttons as siblings (never nested buttons).
 */
export function ClearableQuickFilterChip({
  active,
  clearLabel,
  onClear,
  children,
}: {
  active: boolean;
  clearLabel: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "inline-flex shrink-0 items-center rounded-full",
        active ? "bg-primary text-primary-foreground" : "",
      ].join(" ")}
    >
      {children}
      {active && (
        <button
          type="button"
          aria-label={clearLabel}
          title={clearLabel}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-r-full border-l border-primary-foreground/20 text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClear();
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
