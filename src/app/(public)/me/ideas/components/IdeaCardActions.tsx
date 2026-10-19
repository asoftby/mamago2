"use client";

import Link from "next/link";
import { CalendarPlus, Check, ExternalLink, FolderPlus, Heart, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { C } from "../theme";

type IdeaCardActionsProps = {
  isPlanned: boolean;
  compact?: boolean;
  unsorted?: boolean;
  isPast?: boolean;
  canSchedule?: boolean;
  publicHref?: string | null;
  onSchedule?: () => void;
  onRemove?: () => void;
  onCollection?: () => void;
  isScheduling?: boolean;
  isRemoving?: boolean;
  disabled?: boolean;
};

export function IdeaCardActions({
  isPlanned,
  compact = false,
  unsorted = false,
  isPast = false,
  canSchedule = true,
  publicHref,
  onSchedule,
  onRemove,
  onCollection,
  isScheduling = false,
  isRemoving = false,
  disabled = false,
}: IdeaCardActionsProps) {
  const scheduleDisabled = disabled || isScheduling;
  const removeDisabled = disabled || isRemoving;
  const showOpenAction = !canSchedule || isPast;

  if (unsorted) {
    return (
      <div className="flex min-w-0 items-center justify-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label="Убрать из сохранённых идей"
          title="Убрать из сохранённых идей"
          className="size-11 rounded-full text-primary hover:text-primary"
        >
          {isRemoving ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Heart className="size-5 fill-current" />}
        </Button>
        {onCollection && (
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            onClick={onCollection}
            disabled={disabled}
            aria-label="Добавить в коллекцию"
            title="Добавить в коллекцию"
            className="size-11 rounded-full border-border text-primary"
          >
            <Plus className="size-5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center", compact ? "flex-wrap gap-2 sm:flex-nowrap" : "gap-2")}>
      {showOpenAction && publicHref ? (
        <Button
          type="button"
          asChild
          className={cn("min-w-0 flex-1 rounded-full border text-sm font-semibold shadow-none transition-colors", compact ? "h-11 w-full flex-none px-2 sm:h-[46px] sm:w-auto sm:flex-1 sm:px-4" : "h-[46px] px-4")}
          style={{ borderColor: C.line2, background: "transparent", color: C.ink }}
        >
          <Link href={publicHref} aria-label="Посмотреть">
            <ExternalLink className="size-4" />
            <span className={compact ? "hidden sm:inline" : undefined}>Посмотреть</span>
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onSchedule}
          disabled={scheduleDisabled}
          aria-label={isPlanned ? "В плане" : "Запланировать"}
          className={cn("min-w-0 flex-1 rounded-full border-0 text-sm font-semibold shadow-none transition-colors", compact ? "h-11 w-full flex-none px-2 sm:h-[46px] sm:w-auto sm:flex-1 sm:px-4" : "h-[46px] px-4")}
          style={
            isPlanned
              ? { background: "rgba(20,18,16,0.06)", color: C.ink }
              : { background: C.accent, color: "#fff" }
          }
        >
          {isScheduling ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isPlanned ? (
            <Check className="size-4" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          <span className={compact ? "hidden sm:inline" : undefined}>{isPlanned ? "В плане" : "Запланировать"}</span>
        </Button>
      )}

      {onCollection && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onCollection}
          disabled={disabled}
          aria-label="В коллекцию"
          title="В коллекцию"
          className={cn("shrink-0 rounded-full border bg-transparent shadow-none transition-colors", compact ? "h-11 min-w-11 flex-1 sm:size-[46px] sm:flex-none" : "size-[46px]")}
          style={{ borderColor: C.line2, color: C.accentDeep }}
        >
          <FolderPlus className="size-5" />
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
        className={cn("shrink-0 rounded-full border bg-transparent shadow-none transition-colors", compact ? "h-11 min-w-11 flex-1 sm:size-[46px] sm:flex-none" : "size-[46px]")}
        style={{ borderColor: C.line2, color: C.ink3 }}
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
