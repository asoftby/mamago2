"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleDate } from "./types";

interface ScheduleDateItemProps {
  date: ScheduleDate;
  isActive: boolean;
  onClick: () => void;
  onDelete: (dateId: string) => void;
  className?: string;
}

export function ScheduleDateItem({
  date,
  isActive,
  onClick,
  onDelete,
  className,
}: ScheduleDateItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const slotCount = date.slots.length;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onClick
    onDelete(date.id);
  };

  return (
    <div
      className={cn(
        "relative group",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left px-4 py-3 rounded-lg border transition-all",
          "hover:border-primary/50",
          isActive
            ? "bg-primary/5 border-primary text-primary"
            : "bg-white border-gray-200 text-gray-900",
        )}
      >
        <div className="font-medium text-sm pr-8">{date.label}</div>
        <div className={cn(
          "text-xs mt-0.5",
          isActive ? "text-primary/70" : "text-gray-500"
        )}>
          {slotCount} {slotCount === 1 ? 'слот' : slotCount < 5 ? 'слота' : 'слотов'}
        </div>
      </button>

      {/* Delete Button */}
      <button
        type="button"
        onClick={handleDeleteClick}
        className={cn(
          "absolute top-2 right-2 p-1.5 rounded-md transition-all",
          "hover:bg-red-100 hover:text-red-600",
          isActive || isHovered
            ? "opacity-100 visible"
            : "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
          isActive
            ? "text-primary/60 hover:text-red-600"
            : "text-gray-400 hover:text-red-600"
        )}
        title="Удалить дату"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
