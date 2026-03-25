"use client";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EventStickyActionBar({
  sessionLine,
  priceLabel,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  className,
}: {
  sessionLine?: string;
  priceLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-50 border-t border-border/60 bg-background/95 shadow-[0_-10px_40px_rgba(15,23,42,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85",
        /* На странице события нет MobileBottomNav — прижимаем к низу экрана, safe area внутри padding */
        "bottom-0",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          {sessionLine && (
            <p className="truncate text-[13px] text-muted-foreground">{sessionLine}</p>
          )}
          <p className="text-lg font-semibold text-foreground">{priceLabel}</p>
        </div>
        <div className="flex shrink-0 gap-2 sm:justify-end">
          <PrimaryButton
            type="button"
            className="h-11 flex-1 rounded-2xl px-5 text-[14px] sm:flex-none sm:min-w-[120px]"
            onClick={onPrimary}
          >
            {primaryLabel}
          </PrimaryButton>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-2xl px-5 text-[14px] font-semibold sm:flex-none sm:min-w-[120px]"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
