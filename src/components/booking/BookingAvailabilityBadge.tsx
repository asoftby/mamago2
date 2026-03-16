"use client";

import { cn } from "@/lib/utils";
import type { AvailabilityStatus } from "./types";

interface BookingAvailabilityBadgeProps {
  status: AvailabilityStatus;
  remaining?: number;
  className?: string;
}

export function BookingAvailabilityBadge({
  status,
  remaining,
  className,
}: BookingAvailabilityBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'available':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          label: remaining ? `Осталось ${remaining} ${remaining === 1 ? 'место' : remaining < 5 ? 'места' : 'мест'}` : 'Есть места',
        };
      case 'low':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          label: remaining ? `Осталось ${remaining} ${remaining === 1 ? 'место' : 'места'}` : 'Мест мало',
        };
      case 'sold-out':
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-200',
          text: 'text-gray-600',
          label: 'Мест нет',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium",
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      {config.label}
    </div>
  );
}
