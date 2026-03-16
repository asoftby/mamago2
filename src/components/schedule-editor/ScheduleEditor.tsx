"use client";

import { useState } from "react";
import { Plus, Copy, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleEditorValue, ScheduleDate, ScheduleSlot, SlotFormData } from "./types";
import { ScheduleDateItem } from "./ScheduleDateItem";
import { SlotCard } from "./SlotCard";
import { SlotFormDialog } from "./SlotFormDialog";
import { CopySlotsDialog } from "./CopySlotsDialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ScheduleEditorProps {
  value: ScheduleEditorValue;
  onChange: (value: ScheduleEditorValue) => void;
  className?: string;
}

export function ScheduleEditor({ value, onChange, className }: ScheduleEditorProps) {
  const [selectedDateId, setSelectedDateId] = useState<string | null>(
    value.dates[0]?.id || null
  );
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMultipleDates, setSelectedMultipleDates] = useState<Date[]>([]);
  const [showCopySlotsPrompt, setShowCopySlotsPrompt] = useState(false);
  const [newlyAddedDateId, setNewlyAddedDateId] = useState<string | null>(null);
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<ScheduleDate | null>(null);

  const selectedDate = value.dates.find((d) => d.id === selectedDateId);

  // Handle date deletion request
  const handleDeleteDateRequest = (dateId: string) => {
    const dateToDelete = value.dates.find((d) => d.id === dateId);
    if (!dateToDelete) return;
    
    setDateToDelete(dateToDelete);
    setIsDeleteDialogOpen(true);
  };

  // Confirm date deletion
  const handleConfirmDeleteDate = () => {
    if (!dateToDelete) return;

    const updatedDates = value.dates.filter((d) => d.id !== dateToDelete.id);
    onChange({ dates: updatedDates });

    // Handle selected date state after deletion
    if (selectedDateId === dateToDelete.id) {
      if (updatedDates.length > 0) {
        // Find the next available date or previous if it was the last one
        const deletedIndex = value.dates.findIndex((d) => d.id === dateToDelete.id);
        let newSelectedId: string | null = null;
        
        if (deletedIndex < updatedDates.length) {
          // Select next date
          newSelectedId = updatedDates[deletedIndex]?.id || null;
        } else if (deletedIndex > 0) {
          // Select previous date
          newSelectedId = updatedDates[deletedIndex - 1]?.id || null;
        } else {
          // Select first available date
          newSelectedId = updatedDates[0]?.id || null;
        }
        
        setSelectedDateId(newSelectedId);
      } else {
        setSelectedDateId(null);
      }
    }

    // Close dialog and reset state
    setIsDeleteDialogOpen(false);
    setDateToDelete(null);
  };

  // Cancel date deletion
  const handleCancelDeleteDate = () => {
    setIsDeleteDialogOpen(false);
    setDateToDelete(null);
  };

  // Get existing dates as ISO strings for calendar
  const existingDates = value.dates.map((d) => d.isoDate);

  // Add single date
  const handleAddDate = (date: Date) => {
    const isoDate = date.toISOString().split("T")[0];
    
    // Check if date already exists
    if (value.dates.some((d) => d.isoDate === isoDate)) {
      setIsDatePickerOpen(false);
      return;
    }

    const newDate: ScheduleDate = {
      id: `date-${Date.now()}`,
      isoDate,
      label: formatDateLabel(date),
      slots: [],
    };

    const updatedDates = [...value.dates, newDate].sort((a, b) => 
      a.isoDate.localeCompare(b.isoDate)
    );

    onChange({ dates: updatedDates });
    
    setSelectedDateId(newDate.id);
    setNewlyAddedDateId(newDate.id);
    setIsDatePickerOpen(false);

    // Check if there's a previous date with slots to offer copying
    const newDateIndex = updatedDates.findIndex((d) => d.id === newDate.id);
    if (newDateIndex > 0) {
      const previousDate = updatedDates[newDateIndex - 1];
      if (previousDate.slots.length > 0) {
        setShowCopySlotsPrompt(true);
      }
    }
  };

  // Add multiple dates
  const handleAddMultipleDates = () => {
    if (selectedMultipleDates.length === 0) return;

    const newDates: ScheduleDate[] = [];
    let firstNewDateId: string | null = null;

    selectedMultipleDates.forEach((date) => {
      const isoDate = date.toISOString().split("T")[0];
      
      // Skip if date already exists
      if (value.dates.some((d) => d.isoDate === isoDate)) {
        return;
      }

      const newDate: ScheduleDate = {
        id: `date-${Date.now()}-${Math.random()}`,
        isoDate,
        label: formatDateLabel(date),
        slots: [],
      };

      if (!firstNewDateId) {
        firstNewDateId = newDate.id;
      }

      newDates.push(newDate);
    });

    if (newDates.length === 0) {
      setIsDatePickerOpen(false);
      setIsMultiSelectMode(false);
      setSelectedMultipleDates([]);
      return;
    }

    const updatedDates = [...value.dates, ...newDates].sort((a, b) => 
      a.isoDate.localeCompare(b.isoDate)
    );

    onChange({ dates: updatedDates });
    
    if (firstNewDateId) {
      setSelectedDateId(firstNewDateId);
      setNewlyAddedDateId(firstNewDateId);

      // Check if there's a previous date with slots to offer copying
      const newDateIndex = updatedDates.findIndex((d) => d.id === firstNewDateId);
      if (newDateIndex > 0) {
        const previousDate = updatedDates[newDateIndex - 1];
        if (previousDate.slots.length > 0) {
          setShowCopySlotsPrompt(true);
        }
      }
    }

    setIsDatePickerOpen(false);
    setIsMultiSelectMode(false);
    setSelectedMultipleDates([]);
  };

  // Copy slots from nearest previous date
  const handleCopySlotsFromPrevious = () => {
    if (!newlyAddedDateId) return;

    const newDateIndex = value.dates.findIndex((d) => d.id === newlyAddedDateId);
    if (newDateIndex <= 0) return;

    const previousDate = value.dates[newDateIndex - 1];
    if (previousDate.slots.length === 0) return;

    const updatedDates = value.dates.map((date) => {
      if (date.id === newlyAddedDateId) {
        const copiedSlots = previousDate.slots.map((slot) => ({
          ...slot,
          id: `slot-${Date.now()}-${Math.random()}`,
        }));
        
        return {
          ...date,
          slots: copiedSlots,
        };
      }
      return date;
    });

    onChange({ dates: updatedDates });
    setShowCopySlotsPrompt(false);
    setNewlyAddedDateId(null);
  };

  // Skip copying slots
  const handleSkipCopySlots = () => {
    setShowCopySlotsPrompt(false);
    setNewlyAddedDateId(null);
  };

  // Add or update slot
  const handleSaveSlot = (formData: SlotFormData) => {
    if (!selectedDate) return;

    const updatedDates = value.dates.map((date) => {
      if (date.id === selectedDateId) {
        if (editingSlot) {
          // Update existing slot
          return {
            ...date,
            slots: date.slots.map((slot) =>
              slot.id === editingSlot.id
                ? { ...slot, ...formData }
                : slot
            ),
          };
        } else {
          // Add new slot
          const newSlot: ScheduleSlot = {
            id: `slot-${Date.now()}`,
            ...formData,
          };
          return {
            ...date,
            slots: [...date.slots, newSlot].sort((a, b) =>
              a.startTime.localeCompare(b.startTime)
            ),
          };
        }
      }
      return date;
    });

    onChange({ dates: updatedDates });
    setEditingSlot(null);
  };

  // Delete slot
  const handleDeleteSlot = (slotId: string) => {
    if (!selectedDate) return;

    const updatedDates = value.dates.map((date) => {
      if (date.id === selectedDateId) {
        return {
          ...date,
          slots: date.slots.filter((slot) => slot.id !== slotId),
        };
      }
      return date;
    });

    onChange({ dates: updatedDates });
  };

  // Copy slots to other dates
  const handleCopySlots = (targetDateIds: string[]) => {
    if (!selectedDate || selectedDate.slots.length === 0) return;

    const updatedDates = value.dates.map((date) => {
      if (targetDateIds.includes(date.id)) {
        // Create new slot IDs for copied slots
        const copiedSlots = selectedDate.slots.map((slot) => ({
          ...slot,
          id: `slot-${Date.now()}-${Math.random()}`,
        }));
        
        return {
          ...date,
          slots: [...date.slots, ...copiedSlots].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          ),
        };
      }
      return date;
    });

    onChange({ dates: updatedDates });
  };

  // Format date label
  const formatDateLabel = (date: Date): string => {
    const days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
    const months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря"
    ];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const weekday = days[date.getDay()];
    
    return `${day} ${month}, ${weekday}`;
  };

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg overflow-hidden", className)}>
      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-[300px_1fr]">
        {/* Left: Date List */}
        <div className="border-r border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Даты</h3>
          </div>

          {value.dates.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Нет дат</p>
            </div>
          ) : (
            <div className="space-y-2">
              {value.dates.map((date) => (
                <ScheduleDateItem
                  key={date.id}
                  date={date}
                  isActive={date.id === selectedDateId}
                  onClick={() => setSelectedDateId(date.id)}
                  onDelete={handleDeleteDateRequest}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsDatePickerOpen(true)}
            className="w-full h-10 px-4 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить дату
          </button>
        </div>

        {/* Right: Slots Panel */}
        <div className="p-6">
          {value.dates.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Нет выбранной даты
              </h3>
              <p className="text-sm text-gray-500">
                Добавьте дату, чтобы настроить слоты
              </p>
            </div>
          ) : !selectedDate ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Нет выбранной даты
              </h3>
              <p className="text-sm text-gray-500">
                Выберите дату из списка слева
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Copy Slots Prompt */}
              {showCopySlotsPrompt && selectedDate.id === newlyAddedDateId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Copy className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-3">
                        Скопировать слоты с ближайшей даты?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCopySlotsFromPrevious}
                          className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                        >
                          Скопировать
                        </button>
                        <button
                          type="button"
                          onClick={handleSkipCopySlots}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Начать с пустой
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedDate.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selectedDate.slots.length}{" "}
                    {selectedDate.slots.length === 1
                      ? "слот"
                      : selectedDate.slots.length < 5
                      ? "слота"
                      : "слотов"}
                  </p>
                </div>
                {selectedDate.slots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCopyDialogOpen(true)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Скопировать слоты
                  </button>
                )}
              </div>

              {/* Slots List */}
              {selectedDate.slots.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500 mb-4">
                    На эту дату пока нет слотов
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSlot(null);
                      setIsSlotDialogOpen(true);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить слот
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDate.slots.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      onEdit={() => {
                        setEditingSlot(slot);
                        setIsSlotDialogOpen(true);
                      }}
                      onDelete={() => handleDeleteSlot(slot.id)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSlot(null);
                      setIsSlotDialogOpen(true);
                    }}
                    className="w-full h-10 px-4 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить ещё слот
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden p-4 space-y-4">
        {/* Date Selector */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Даты</h3>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить
            </button>
          </div>

          {value.dates.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Добавьте первую дату
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {value.dates.map((date) => (
                <div key={date.id} className="relative group flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDateId(date.id)}
                    className={cn(
                      "px-4 py-2.5 rounded-lg border transition-all text-left",
                      date.id === selectedDateId
                        ? "bg-primary/5 border-primary"
                        : "bg-white border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-medium",
                      date.id === selectedDateId ? "text-primary" : "text-gray-900"
                    )}>
                      {date.label.split(",")[0]}
                    </div>
                    <div className={cn(
                      "text-xs mt-0.5",
                      date.id === selectedDateId ? "text-primary/70" : "text-gray-500"
                    )}>
                      {date.slots.length}{" "}
                      {date.slots.length === 1 ? "слот" : date.slots.length < 5 ? "слота" : "слотов"}
                    </div>
                  </button>
                  
                  {/* Mobile Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteDateRequest(date.id)}
                    className={cn(
                      "absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs",
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      date.id === selectedDateId ? "opacity-100" : ""
                    )}
                    title="Удалить дату"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slots Panel */}
        {value.dates.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Нет выбранной даты
            </h3>
            <p className="text-sm text-gray-500">
              Добавьте дату, чтобы настроить слоты
            </p>
          </div>
        ) : selectedDate ? (
          <div className="space-y-4">
            {/* Copy Slots Prompt */}
            {showCopySlotsPrompt && selectedDate.id === newlyAddedDateId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Copy className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-900 mb-2">
                      Скопировать слоты с ближайшей даты?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCopySlotsFromPrevious}
                        className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                      >
                        Скопировать
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipCopySlots}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Начать с пустой
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Слоты</h3>
              {selectedDate.slots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCopyDialogOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Копировать
                </button>
              )}
            </div>

            {selectedDate.slots.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 mb-4">
                  На эту дату пока нет слотов
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlot(null);
                    setIsSlotDialogOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить слот
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDate.slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onEdit={() => {
                      setEditingSlot(slot);
                      setIsSlotDialogOpen(true);
                    }}
                    onDelete={() => handleDeleteSlot(slot.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlot(null);
                    setIsSlotDialogOpen(true);
                  }}
                  className="w-full h-10 px-4 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить ещё слот
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Нет выбранной даты
            </h3>
            <p className="text-sm text-gray-500">
              Выберите дату из списка выше
            </p>
          </div>
        )}
      </div>

      {/* Date Picker Dialog */}
      <Dialog open={isDatePickerOpen} onOpenChange={(open) => {
        setIsDatePickerOpen(open);
        if (!open) {
          setIsMultiSelectMode(false);
          setSelectedMultipleDates([]);
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Добавить дату</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Multi-select toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMultiSelectMode}
                onChange={(e) => {
                  setIsMultiSelectMode(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedMultipleDates([]);
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">
                Выбрать несколько дат
              </span>
            </label>

            {/* Calendar */}
            <div className="flex justify-center">
              {isMultiSelectMode ? (
                <Calendar
                  mode="multiple"
                  selectedDates={selectedMultipleDates}
                  onMultipleChange={setSelectedMultipleDates}
                  disablePast={true}
                  disabledDates={existingDates}
                />
              ) : (
                <Calendar
                  value={null}
                  onChange={(date) => date && handleAddDate(date)}
                  disablePast={true}
                  disabledDates={existingDates}
                />
              )}
            </div>

            {/* Action buttons for multi-select mode */}
            {isMultiSelectMode && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  type="button"
                  onClick={handleAddMultipleDates}
                  disabled={selectedMultipleDates.length === 0}
                  className="flex-1"
                >
                  Добавить ({selectedMultipleDates.length})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDatePickerOpen(false);
                    setIsMultiSelectMode(false);
                    setSelectedMultipleDates([]);
                  }}
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <SlotFormDialog
        isOpen={isSlotDialogOpen}
        onClose={() => {
          setIsSlotDialogOpen(false);
          setEditingSlot(null);
        }}
        onSave={handleSaveSlot}
        onDelete={editingSlot ? () => handleDeleteSlot(editingSlot.id) : undefined}
        slot={editingSlot}
        title={editingSlot ? "Редактировать слот" : "Добавить слот"}
        existingSlots={selectedDate?.slots || []}
      />

      <CopySlotsDialog
        isOpen={isCopyDialogOpen}
        onClose={() => setIsCopyDialogOpen(false)}
        onCopy={handleCopySlots}
        sourceDate={selectedDate || null}
        availableDates={value.dates}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить дату?</AlertDialogTitle>
            <AlertDialogDescription>
              {dateToDelete && dateToDelete.slots.length > 0 ? (
                <>
                  Будут удалены все слоты на {dateToDelete.label.split(",")[0].toLowerCase()}.
                </>
              ) : (
                <>
                  Дата {dateToDelete?.label.split(",")[0].toLowerCase()} будет удалена.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDeleteDate}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteDate}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
