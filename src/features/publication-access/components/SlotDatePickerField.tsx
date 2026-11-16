"use client";

import { useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatSlotDateLabel,
  localDateToSlotDate,
  slotDateToLocalDate,
} from "../schedule/slotDate";

export type SlotDatePickerFieldProps = {
  /** DOM id of the trigger button (the visible `<Label htmlFor>` points at it). */
  id: string;
  /** DOM id of the visible label; the selected date is appended to the accessible name. */
  labelId: string;
  /** Space separated ids of hint / error text that describe the field. */
  describedBy?: string;
  /** "YYYY-MM-DD" or an empty string. */
  value: string;
  onChange: (value: string) => void;
  /** Fired when the user leaves the field or dismisses the calendar (validation "touched"). */
  onTouched?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

/**
 * Compact calendar popover for a booking-slot date.
 * Replaces the native `<input type="date">`; the stored value stays "YYYY-MM-DD".
 */
export function SlotDatePickerField({
  id,
  labelId,
  describedBy,
  value,
  onChange,
  onTouched,
  disabled,
  invalid,
  className,
}: SlotDatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  // The trigger blurs when focus moves into the popover; that must not count as "touched".
  const openRef = useRef(false);
  const selected = slotDateToLocalDate(value);
  const label = formatSlotDateLabel(value);
  const valueId = `${id}-value`;

  const handleOpenChange = (next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (!next) onTouched?.();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-describedby={describedBy}
          data-invalid={invalid ? "true" : undefined}
          onBlur={() => {
            if (!openRef.current) onTouched?.();
          }}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-[12px] transition-colors",
            "hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[invalid=true]:border-destructive data-[invalid=true]:ring-[3px] data-[invalid=true]:ring-destructive/20",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span id={valueId} className="truncate">
              {label ?? "Выберите дату"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          size="compact"
          value={selected}
          defaultMonth={selected ?? undefined}
          onChange={(date) => {
            if (!date) return;
            onChange(localDateToSlotDate(date));
            handleOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
