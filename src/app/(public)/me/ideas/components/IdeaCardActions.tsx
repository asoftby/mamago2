"use client";

import Link from "next/link";
import { CalendarPlus, Check, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IdeaCardActionsProps = {
  isPlanned: boolean;
  isPast?: boolean;
  publicHref?: string | null;
  onSchedule?: () => void;
  onRemove?: () => void;
  isScheduling?: boolean;
  isRemoving?: boolean;
  disabled?: boolean;
};

export function IdeaCardActions({
  isPlanned,
  isPast = false,
  publicHref,
  onSchedule,
  onRemove,
  isScheduling = false,
  isRemoving = false,
  disabled = false,
}: IdeaCardActionsProps) {
  const scheduleDisabled = disabled || isScheduling;
  const removeDisabled = disabled || isRemoving;

  return (
    <div className="flex items-center gap-2">
      {isPast && publicHref ? (
        <Button
          type="button"
          asChild
          className="h-10 flex-1 rounded-full border-0 bg-[rgba(20,18,16,0.06)] px-4 text-sm font-semibold text-[#141210] shadow-none transition-colors hover:bg-[rgba(20,18,16,0.09)]"
        >
          <Link href={publicHref}>
            <ExternalLink className="size-4" />
            Посмотреть
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onSchedule}
          disabled={scheduleDisabled}
          className={cn(
            "h-10 flex-1 rounded-full border-0 px-4 text-sm font-semibold shadow-none transition-colors",
            isPlanned
              ? "bg-[rgba(20,18,16,0.06)] text-[#141210] hover:bg-[rgba(20,18,16,0.09)]"
              : "bg-[#EF8759] text-white hover:bg-[#E07848]",
          )}
        >
          {isScheduling ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isPlanned ? (
            <Check className="size-4" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          {isPlanned ? "В плане" : "Запланировать"}
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onRemove}
        disabled={removeDisabled}
        aria-label="Убрать из идей"
        title="Убрать из идей"
        className="size-10 rounded-full border-[rgba(20,18,16,0.08)] bg-white text-[rgba(20,18,16,0.65)] shadow-none hover:bg-[rgba(20,18,16,0.04)] hover:text-[#141210]"
      >
        {isRemoving ? (
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </Button>
    </div>
  );
}
