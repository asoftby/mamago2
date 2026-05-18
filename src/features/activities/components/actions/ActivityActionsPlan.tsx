"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActivityCardItem } from "@/features/activities/types";

type ActivityActionsPlanProps = {
  item?: ActivityCardItem;
  onSchedule?: () => void;
  onRemove?: () => void;
  className?: string;
  scheduleLabel?: string;
  removeLabel?: string;
  isScheduling?: boolean;
  isRemoving?: boolean;
  disabled?: boolean;
  showSchedule?: boolean;
  showRemove?: boolean;
  removeIconOnly?: boolean;
  compact?: boolean;
};

export function ActivityActionsPlan({
  onSchedule,
  onRemove,
  className,
  scheduleLabel = "Запланировать",
  removeLabel = "Убрать",
  isScheduling = false,
  isRemoving = false,
  disabled = false,
  showSchedule = true,
  showRemove = true,
  removeIconOnly = false,
  compact = false,
}: ActivityActionsPlanProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center",
        compact ? "gap-1.5" : "gap-2",
        className,
      )}
    >
      {showSchedule ? (
        <Button
          type="button"
          size="sm"
          className={cn(
            "rounded-full",
            compact && "h-8 px-3.5 text-[13px] shadow-sm",
          )}
          onClick={onSchedule}
          disabled={disabled || isScheduling}
        >
          {isScheduling ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          {scheduleLabel}
        </Button>
      ) : null}
      {showRemove ? (
        <Button
          type="button"
          variant="outline"
          size={removeIconOnly ? "icon-sm" : "sm"}
          className={cn(
            "rounded-full",
            compact &&
              (removeIconOnly
                ? "size-8 shadow-sm"
                : "h-8 px-3 text-[13px] shadow-sm"),
          )}
          onClick={onRemove}
          disabled={disabled || isRemoving}
          aria-label={removeLabel}
          title={removeLabel}
        >
          {isRemoving ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {!removeIconOnly ? removeLabel : null}
        </Button>
      ) : null}
    </div>
  );
}
