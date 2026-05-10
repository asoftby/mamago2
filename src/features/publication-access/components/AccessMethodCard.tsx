"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AccessMethodCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
};

export function AccessMethodCard({
  title,
  description,
  icon: Icon,
  selected,
  disabled,
  onClick,
  children,
}: AccessMethodCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors overflow-hidden",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full text-left px-4 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                "w-5 h-5 flex-shrink-0 mt-0.5",
                selected ? "text-primary" : "text-muted-foreground",
              )}
            />
            {selected ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900">{title}</div>
            <div className="text-[12px] text-gray-600 mt-0.5">{description}</div>
          </div>
        </div>
      </button>

      {selected && children ? (
        <div className="border-t border-primary/15 bg-muted/50 px-4 py-4 space-y-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

