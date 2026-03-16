"use client";

import { Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleSlot } from "./types";

interface SlotCardProps {
  slot: ScheduleSlot;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

export function SlotCard({ slot, onEdit, onDelete, className }: SlotCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-gray-200 rounded-lg p-4",
        "flex items-center justify-between gap-3",
        "hover:border-gray-300 transition-colors",
        className
      )}
    >
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">
          {slot.startTime}–{slot.endTime}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {slot.capacity} {slot.capacity === 1 ? 'место' : slot.capacity < 5 ? 'места' : 'мест'}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
          title="Редактировать"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Удалить"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
