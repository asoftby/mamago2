"use client";

import { Clock, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ScheduleSlot } from "../../schedule/types";

export type ScheduleSlotRowProps = {
  slot: ScheduleSlot;
  onChange: (patch: Partial<ScheduleSlot>) => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function ScheduleSlotRow({
  slot,
  onChange,
  onRemove,
  disabled,
}: ScheduleSlotRowProps) {
  const timeLabel =
    slot.startTime && slot.endTime
      ? `${slot.startTime} → ${slot.endTime}`
      : slot.startTime || "—";

  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-100 bg-stone-50/90 px-4 py-3 shadow-sm",
        "transition-shadow hover:shadow",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 sm:hidden">
        <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
          <Clock className="h-4 w-4 text-primary" aria-hidden />
          {timeLabel}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {slot.capacity}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Начало
          </Label>
          <Input
            type="time"
            value={slot.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            disabled={disabled}
            className="rounded-xl border-stone-200 bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Конец
          </Label>
          <Input
            type="time"
            value={slot.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
            disabled={disabled}
            className="rounded-xl border-stone-200 bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden />
            Мест
          </Label>
          <Input
            type="number"
            min={1}
            value={slot.capacity}
            onChange={(e) =>
              onChange({
                capacity: Math.max(1, Number(e.target.value) || 1),
              })
            }
            disabled={disabled}
            className="rounded-xl border-stone-200 bg-white"
          />
        </div>
        <div className="flex justify-end sm:pb-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Удалить слот"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mt-2 hidden text-xs text-stone-600 sm:block">
        <Clock className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
        {timeLabel}
        <span className="mx-2 text-stone-300">·</span>
        <Users className="mr-0.5 inline h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {slot.capacity} мест
      </p>
    </div>
  );
}
