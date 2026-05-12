"use client";

import { Button } from "@/components/ui/button";
import { Check, Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfferActionsProps {
  primaryLabel: string;
  secondaryLabel?: string;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isInPlan?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  onSave?: () => void;
}

/**
 * Actions Card (Sidebar)
 * Primary CTA: Купить / Записаться / Забронировать
 * Secondary: В план / Сохранить / Поделиться
 */
export function OfferActions({
  primaryLabel,
  secondaryLabel,
  isPrimaryLoading = false,
  isSecondaryLoading = false,
  isInPlan = false,
  onPrimary,
  onSecondary,
  onSave,
}: OfferActionsProps) {
  return (
    <div className="space-y-3 rounded-3xl border border-border/60 bg-background p-6 shadow-lg">
      {/* Primary CTA */}
      <Button
        type="button"
        size="lg"
        className={cn(
          "w-full h-12 rounded-xl text-[15px] font-semibold",
          "bg-[#EF8759] hover:bg-[#EF8759]/90 text-white",
          "shadow-sm hover:shadow-md transition-all"
        )}
        onClick={onPrimary}
        disabled={isPrimaryLoading}
      >
        {isPrimaryLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          primaryLabel
        )}
      </Button>

      {/* Secondary CTA (В план) */}
      {secondaryLabel && onSecondary && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={cn(
            "w-full h-12 rounded-xl text-[15px] font-semibold",
            isInPlan
              ? "gap-2 border-[#EF8759] bg-[#FFF7F3] text-[#EF8759] hover:bg-[#FFF0E8]"
              : "border-border/80 hover:border-border hover:bg-accent/50"
          )}
          onClick={onSecondary}
          disabled={isSecondaryLoading}
        >
          {isSecondaryLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              {isInPlan && <Check className="h-4 w-4" />}
              {secondaryLabel}
            </>
          )}
        </Button>
      )}

      {/* Tertiary Actions */}
      <div className="flex items-center gap-2 pt-2">
        {onSave && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 gap-2 text-[14px] text-muted-foreground hover:text-foreground"
            onClick={onSave}
          >
            <Heart className={cn("h-4 w-4", isInPlan && "fill-current text-[#EF8759]")} />
            Сохранить
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1 gap-2 text-[14px] text-muted-foreground hover:text-foreground"
          onClick={() => {
            // TODO: Implement share functionality
            if (navigator.share) {
              navigator.share({
                title: document.title,
                url: window.location.href,
              }).catch(() => {
                // Ignore share cancellation
              });
            }
          }}
        >
          <Share2 className="h-4 w-4" />
          Поделиться
        </Button>
      </div>
    </div>
  );
}
