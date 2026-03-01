"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type FilterPillProps = {
  label: string;
  valueText?: string | null;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  rightSlot?: React.ReactNode;
};

export const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  (
    {
      label,
      valueText,
      isActive = false,
      onClick,
      className,
      disabled = false,
      rightSlot,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          // Base styles
          "group flex items-center justify-between gap-2 h-10 px-4 rounded-full border transition-all text-sm font-medium whitespace-nowrap outline-none",
          // Default state
          "bg-background border-border/60 text-foreground hover:border-border",
          // Active state
          isActive && "bg-primary/5 border-primary/60 text-foreground",
          // Disabled state
          disabled && "opacity-50 pointer-events-none",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className={cn("truncate", isActive ? "text-muted-foreground" : "text-foreground")}>
            {label}
          </span>
          {valueText && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="truncate text-foreground font-semibold">
                {valueText}
              </span>
            </>
          )}
        </div>
        
        {rightSlot || (
          <ChevronDown 
            className={cn(
              "h-4 w-4 opacity-50 shrink-0 transition-transform duration-200",
              // Optional: rotate if needed, usually handled by parent state passed as prop if we wanted rotation
            )} 
          />
        )}
      </button>
    );
  }
);

FilterPill.displayName = "FilterPill";
