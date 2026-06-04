"use client";

import { Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ScheduleSlot } from "../../schedule/types";

type SlotErrors = {
  startTime?: string;
  endTime?: string;
  capacity?: string;
};

export type ScheduleSlotRowProps = {
  slot: ScheduleSlot;
  errors?: SlotErrors;
  canRemove?: boolean;
  onChange: (patch: Partial<ScheduleSlot>) => void;
  onBlurField?: (field: keyof SlotErrors) => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function ScheduleSlotRow({
  slot,
  errors,
  canRemove = true,
  onChange,
  onBlurField,
  onRemove,
  disabled,
}: ScheduleSlotRowProps) {
  return (
    <div className="rounded-2xl border border-border bg-background px-3 py-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_110px_auto] md:items-start">
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-muted-foreground">
            Начало
          </Label>
          <Input
            type="time"
            value={slot.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            onBlur={() => onBlurField?.("startTime")}
            disabled={disabled}
            aria-invalid={errors?.startTime ? "true" : "false"}
            className="h-10 rounded-xl border-border bg-background text-[12px] focus-visible:border-primary focus-visible:ring-primary/20"
          />
          {errors?.startTime ? (
            <p className="text-[11px] leading-4 text-primary">{errors.startTime}</p>
          ) : null}
        </div>

        <div className="hidden pt-8 text-[12px] text-muted-foreground md:block">—</div>

        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-muted-foreground">
            Окончание
          </Label>
          <Input
            type="time"
            value={slot.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
            onBlur={() => onBlurField?.("endTime")}
            disabled={disabled}
            aria-invalid={errors?.endTime ? "true" : "false"}
            className="h-10 rounded-xl border-border bg-background text-[12px] focus-visible:border-primary focus-visible:ring-primary/20"
          />
          {errors?.endTime ? (
            <p className="text-[11px] leading-4 text-primary">{errors.endTime}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
            Вместимость
          </Label>
          <Input
            type="number"
            min={1}
            value={slot.capacity ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                capacity: raw === "" ? null : Math.max(1, Number(raw) || 1),
              });
            }}
            onBlur={() => onBlurField?.("capacity")}
            disabled={disabled}
            aria-invalid={errors?.capacity ? "true" : "false"}
            className="h-10 rounded-xl border-border bg-background text-[12px] focus-visible:border-primary focus-visible:ring-primary/20"
          />
          {errors?.capacity ? (
            <p className="text-[11px] leading-4 text-primary">{errors.capacity}</p>
          ) : null}
        </div>

        <div className="flex justify-end pt-6">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              "rounded-xl text-muted-foreground hover:bg-primary/5 hover:text-primary",
              !canRemove && "opacity-50",
            )}
            onClick={onRemove}
            disabled={disabled || !canRemove}
            aria-label="Удалить слот"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
