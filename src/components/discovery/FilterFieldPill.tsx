"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Loader2 } from "lucide-react";

export type FilterFieldPillProps = {
  label: string;
  value: string;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  onClear?: () => void;
  rightIcon?: React.ReactNode;
  className?: string;
};

/**
 * FilterFieldPill - Two-line filter button matching WhenSelect style
 * 
 * Extracted from WhenSelect trigger button styling to ensure visual consistency
 * across all filter types (When/Age/Metro/District).
 */
export function FilterFieldPill({
  label,
  value,
  selected = false,
  disabled = false,
  loading = false,
  onClick,
  onClear,
  rightIcon,
  className,
}: FilterFieldPillProps) {
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        // Base styles from WhenSelect trigger
        "gap-2 whitespace-nowrap text-sm disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "shadow-xs hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        "has-[>svg]:px-3 h-auto min-h-[56px] w-full justify-between",
        "rounded-full border border-gray-200 bg-white px-5 py-3 transition-all hover:bg-gray-50",
        "flex items-center text-left font-normal",
        // Selected state
        selected && "border-primary bg-primary/5",
        className
      )}
    >
      {/* Left: Two-line label/value */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-xs text-muted-foreground font-medium truncate">
          {label}
        </span>
        <span className={cn(
          "text-sm truncate",
          selected ? "text-foreground font-medium" : "text-muted-foreground"
        )}>
          {value}
        </span>
      </div>

      {/* Right: Icons */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin opacity-50" />
        )}
        
        {!loading && selected && onClear && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClear(e as any);
              }
            }}
            className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </div>
        )}
        
        {rightIcon || <ChevronDown className="h-4 w-4 opacity-50" />}
      </div>
    </button>
  );
}
