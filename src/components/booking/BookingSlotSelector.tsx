"use client";

import { cn } from "@/lib/utils";
import type { BookingSlot } from "./types";

interface BookingSlotSelectorProps {
  slots: BookingSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  className?: string;
}

export function BookingSlotSelector({
  slots,
  selectedSlotId,
  onSelectSlot,
  className,
}: BookingSlotSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm font-medium text-gray-900">Выберите время</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {slots.map((slot) => {
          const isSelected = slot.id === selectedSlotId;
          const isSoldOut = slot.status === 'sold-out' || slot.disabled;
          const isLow = slot.status === 'low';
          
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => !isSoldOut && onSelectSlot(slot.id)}
              disabled={isSoldOut}
              className={cn(
                "px-3 py-3 rounded-lg border text-sm font-medium transition-all",
                "hover:border-primary/50 active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300",
                "flex flex-col items-center gap-1",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-300"
              )}
            >
              <span className={cn(isSoldOut && "line-through")}>{slot.label}</span>
              {!isSoldOut && isLow && (
                <span className="text-xs opacity-75">
                  {slot.remaining} {slot.remaining === 1 ? 'место' : 'места'}
                </span>
              )}
              {isSoldOut && (
                <span className="text-xs opacity-75">Нет мест</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
