"use client";

import { useState } from "react";
import { X, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleDate } from "./types";

interface CopySlotsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: (targetDateIds: string[]) => void;
  sourceDate: ScheduleDate | null;
  availableDates: ScheduleDate[];
}

export function CopySlotsDialog({
  isOpen,
  onClose,
  onCopy,
  sourceDate,
  availableDates,
}: CopySlotsDialogProps) {
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>([]);

  const handleToggleDate = (dateId: string) => {
    setSelectedDateIds((prev) =>
      prev.includes(dateId)
        ? prev.filter((id) => id !== dateId)
        : [...prev, dateId]
    );
  };

  const handleCopy = () => {
    if (selectedDateIds.length > 0) {
      onCopy(selectedDateIds);
      setSelectedDateIds([]);
      onClose();
    }
  };

  if (!isOpen || !sourceDate) return null;

  const targetDates = availableDates.filter((d) => d.id !== sourceDate.id);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Скопировать слоты
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Source Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900 mb-1">
                Откуда копируем:
              </div>
              <div className="text-sm text-blue-800">{sourceDate.label}</div>
              <div className="text-xs text-blue-700 mt-1">
                {sourceDate.slots.length}{" "}
                {sourceDate.slots.length === 1
                  ? "слот"
                  : sourceDate.slots.length < 5
                  ? "слота"
                  : "слотов"}
              </div>
            </div>

            {/* Target Dates */}
            <div>
              <div className="text-sm font-medium text-gray-900 mb-3">
                Выберите даты для копирования:
              </div>
              {targetDates.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Нет доступных дат для копирования
                </div>
              ) : (
                <div className="space-y-2">
                  {targetDates.map((date) => (
                    <button
                      key={date.id}
                      type="button"
                      onClick={() => handleToggleDate(date.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg border transition-all",
                        "hover:border-primary/50",
                        selectedDateIds.includes(date.id)
                          ? "bg-primary/5 border-primary"
                          : "bg-white border-gray-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {date.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {date.slots.length > 0
                              ? `${date.slots.length} ${
                                  date.slots.length === 1
                                    ? "слот"
                                    : date.slots.length < 5
                                    ? "слота"
                                    : "слотов"
                                }`
                              : "Нет слотов"}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                            selectedDateIds.includes(date.id)
                              ? "bg-primary border-primary"
                              : "border-gray-300"
                          )}
                        >
                          {selectedDateIds.includes(date.id) && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Helper Text */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                Слоты будут добавлены к существующим слотам на выбранных датах
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={selectedDateIds.length === 0}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                selectedDateIds.length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              Скопировать
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
