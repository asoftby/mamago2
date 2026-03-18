"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleSlot, SlotFormData } from "./types";

interface SlotFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SlotFormData) => void;
  onDelete?: () => void;
  slot?: ScheduleSlot | null;
  title?: string;
  existingSlots?: ScheduleSlot[]; // For overlap validation
}

export function SlotFormDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  slot,
  title = "Добавить слот",
  existingSlots = [],
}: SlotFormDialogProps) {
  const [formData, setFormData] = useState<SlotFormData>({
    startTime: slot?.startTime || "10:00",
    endTime: slot?.endTime || "11:00",
    capacity: slot?.capacity || 6,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateFormData = () => {
      if (slot) {
        setFormData({
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
        });
      } else {
        setFormData({
          startTime: "10:00",
        endTime: "11:00",
        capacity: 6,
      });
    }
    setError(null);
    };
    
    requestAnimationFrame(updateFormData);
  }, [slot, isOpen]);

  // Check if time slots overlap
  const checkTimeOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    // Convert time strings to minutes for easier comparison
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start1Min = timeToMinutes(start1);
    const end1Min = timeToMinutes(end1);
    const start2Min = timeToMinutes(start2);
    const end2Min = timeToMinutes(end2);

    // Check if intervals overlap
    return start1Min < end2Min && start2Min < end1Min;
  };

  const validateSlot = (): boolean => {
    setError(null);

    // Check if end time is after start time
    if (formData.startTime >= formData.endTime) {
      setError("Время окончания должно быть позже времени начала");
      return false;
    }

    // Check for overlaps with existing slots (excluding current slot if editing)
    const slotsToCheck = existingSlots.filter(s => !slot || s.id !== slot.id);
    
    for (const existingSlot of slotsToCheck) {
      if (checkTimeOverlap(
        formData.startTime,
        formData.endTime,
        existingSlot.startTime,
        existingSlot.endTime
      )) {
        setError(`Слот пересекается с существующим: ${existingSlot.startTime}–${existingSlot.endTime}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSlot()) {
      return;
    }

    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Время начала</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Время окончания</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Количество мест</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="100"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })
                }
                required
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
              {slot && onDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Удалить слот
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
