"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { EventScheduleItem, EventScheduleCardProps } from "./types";

export function EventScheduleCard({
  item,
  onChange,
  onRemove,
  canRemove,
  disabled = false,
}: EventScheduleCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(item.isCollapsed || false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isUntilPickerOpen, setIsUntilPickerOpen] = useState(false);
  
  // Temporary state for date range selection in multi-day mode
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);

  const handleUpdate = (updates: Partial<EventScheduleItem>) => {
    onChange({ ...item, ...updates });
  };

  // Convert date string to Date object
  const selectedDate = item.date ? new Date(item.date) : null;
  const untilDate = item.recurrenceUntil ? new Date(item.recurrenceUntil) : null;
  
  // Calculate next month for second calendar
  const getNextMonth = () => {
    const baseDate = tempStartDate || selectedDate || new Date();
    const nextMonth = new Date(baseDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  };

  // Handle date selection from calendar
  const handleDateSelect = (date: Date | null) => {
    if (date) {
      if (!item.isMultiDay) {
        // Single date mode - save immediately
        const dateStr = dateToLocalString(date);
        handleUpdate({ date: dateStr });
        setIsDatePickerOpen(false);
      } else {
        // Multi-day mode - select range
        if (!tempStartDate || (tempStartDate && tempEndDate)) {
          // Start new selection - clear previous dates
          setTempStartDate(date);
          setTempEndDate(null);
          // Clear the saved date to avoid showing old selection
          handleUpdate({ date: null, dateEnd: null });
        } else {
          // Complete the range
          if (date < tempStartDate) {
            // If selected date is before start, swap them
            setTempEndDate(tempStartDate);
            setTempStartDate(date);
          } else {
            setTempEndDate(date);
          }
        }
      }
    }
  };
  
  // Convert Date to local YYYY-MM-DD string without timezone shift
  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Save the selected date range
  const handleSaveDateRange = () => {
    if (tempStartDate) {
      const startStr = dateToLocalString(tempStartDate);
      const updates: Partial<EventScheduleItem> = { date: startStr };
      
      // Save end date if selected
      if (tempEndDate) {
        const endStr = dateToLocalString(tempEndDate);
        updates.dateEnd = endStr;
      }
      
      handleUpdate(updates);
      // Reset temp state
      setTempStartDate(null);
      setTempEndDate(null);
      setIsDatePickerOpen(false);
    }
  };
  
  // Cancel date range selection
  const handleCancelDateRange = () => {
    // Clear the dates in the form
    handleUpdate({ date: null, dateEnd: null });
    // Reset temp state
    setTempStartDate(null);
    setTempEndDate(null);
    setIsDatePickerOpen(false);
  };
  
  // Open date picker and initialize temp state
  const handleOpenDatePicker = (open: boolean) => {
    if (open && item.isMultiDay) {
      // Initialize with current dates if exist
      if (selectedDate) {
        setTempStartDate(selectedDate);
        setTempEndDate(item.dateEnd ? new Date(item.dateEnd) : null);
      }
    } else if (!open) {
      // Reset temp state when closing
      setTempStartDate(null);
      setTempEndDate(null);
    }
    setIsDatePickerOpen(open);
  };

  const handleUntilDateSelect = (date: Date | null) => {
    if (date) {
      const dateStr = dateToLocalString(date);
      handleUpdate({ recurrenceUntil: dateStr });
      setIsUntilPickerOpen(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Выберите дату";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  
  // Get short month name (3 letters)
  const getShortMonth = (date: Date): string => {
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    return months[date.getMonth()];
  };
  
  // Format date range for multi-day mode
  const formatDateRange = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return "Выберите дату";
    
    const start = new Date(startStr);
    const startDay = start.getDate();
    const startMonth = getShortMonth(start);
    
    if (!endStr || !item.isMultiDay) {
      // Single date or no end date yet
      return formatDate(startStr);
    }
    
    const end = new Date(endStr);
    const endDay = end.getDate();
    const endMonth = getShortMonth(end);
    
    // Same month: "13-15 мар"
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${startDay}-${endDay} ${startMonth}`;
    }
    
    // Different months: "13 мар - 20 апр"
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="text-base font-medium text-gray-900">Дата</h3>
        <div className="flex items-center gap-2">
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title={isCollapsed ? "Развернуть" : "Свернуть"}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsed Summary */}
      {isCollapsed && (
        <div className="px-6 py-4 text-sm text-gray-600 space-y-1">
          <p>
            {item.date || "Дата не выбрана"}
            {item.allDay ? " (весь день)" : ` ${item.startTime} - ${item.endTime}`}
          </p>
          {item.recurringEnabled && (
            <p className="text-xs text-primary">
              Повторяется каждые {item.recurrenceInterval} {item.recurrenceUnit}
            </p>
          )}
        </div>
      )}

      {/* Body */}
      {!isCollapsed && (
        <div className="px-6 py-6 space-y-6">
          {/* Multi-day Switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`multiday-${item.id}`} className="text-sm font-normal text-gray-700">
              Несколько дней?
            </Label>
            <Switch
              id={`multiday-${item.id}`}
              checked={item.isMultiDay}
              disabled={disabled}
              onCheckedChange={(checked) => {
                const updates: Partial<EventScheduleItem> = { isMultiDay: checked };
                // Clear dateEnd when disabling multi-day mode
                if (!checked) {
                  updates.dateEnd = null;
                }
                handleUpdate(updates);
              }}
            />
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor={`date-${item.id}`} className="text-sm font-medium text-gray-900">
              Дата
            </Label>
            <Popover open={isDatePickerOpen} onOpenChange={handleOpenDatePicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full h-11 px-4 rounded-lg border border-gray-300 bg-white",
                    "flex items-center justify-between",
                    "text-sm text-left",
                    "hover:border-gray-400 transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    !item.date && "text-gray-500"
                  )}
                >
                  <span>{formatDateRange(item.date, item.dateEnd || null)}</span>
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="p-0 bg-white" 
                align="start"
                side="bottom"
                sideOffset={4}
                style={{ width: 'var(--radix-popover-trigger-width)' }}
              >
                <div className="bg-white">
                  <div className={cn(
                    "bg-white",
                    item.isMultiDay ? "flex" : ""
                  )}>
                    <div className={cn(
                      "bg-white p-3 sm:p-4",
                      item.isMultiDay ? "flex-1 border-r border-gray-200" : "w-full"
                    )}>
                      <Calendar
                        size="compact"
                        value={selectedDate}
                        onChange={handleDateSelect}
                        disablePast={true}
                        rangeStart={tempStartDate}
                        rangeEnd={tempEndDate}
                        minDate={tempStartDate && !tempEndDate ? tempStartDate : null}
                      />
                    </div>
                    {item.isMultiDay && (
                      <div className="flex-1 bg-white p-3 sm:p-4">
                        <Calendar
                          size="compact"
                          value={null}
                          onChange={handleDateSelect}
                          disablePast={true}
                          defaultMonth={getNextMonth()}
                          rangeStart={tempStartDate}
                          rangeEnd={tempEndDate}
                          minDate={tempStartDate && !tempEndDate ? tempStartDate : null}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Save button for multi-day mode */}
                  {item.isMultiDay && tempStartDate && (
                    <div className="border-t border-gray-200 bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-gray-600 sm:text-sm">
                        {tempEndDate ? (
                          <span>
                            {tempStartDate.getDate()} {getShortMonth(tempStartDate)}
                            {" — "}
                            {tempEndDate.getDate()} {getShortMonth(tempEndDate)}
                          </span>
                        ) : (
                          <span>Выберите конечную дату</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCancelDateRange}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          Очистить
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDateRange}
                          disabled={!tempStartDate}
                          className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                            "bg-primary text-primary-foreground hover:bg-primary/90",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* All-day Switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`allday-${item.id}`} className="text-sm font-normal text-gray-700">
              Весь день
            </Label>
            <Switch
              id={`allday-${item.id}`}
              checked={item.allDay}
              disabled={disabled}
              onCheckedChange={(checked) => handleUpdate({ allDay: checked })}
            />
          </div>

          {/* Time Fields */}
          {!item.allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`start-${item.id}`} className="text-sm font-medium text-gray-900">
                  Начало
                </Label>
                <Input
                  id={`start-${item.id}`}
                  type="time"
                  value={item.startTime}
                  onChange={(e) => handleUpdate({ startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`end-${item.id}`} className="text-sm font-medium text-gray-900">
                  Конец
                </Label>
                <Input
                  id={`end-${item.id}`}
                  type="time"
                  value={item.endTime}
                  onChange={(e) => handleUpdate({ endTime: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Recurring Switch */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <Label htmlFor={`recurring-${item.id}`} className="text-sm font-normal text-gray-700">
              Повторять?
            </Label>
            <Switch
              id={`recurring-${item.id}`}
              checked={item.recurringEnabled}
              disabled={disabled}
              onCheckedChange={(checked) => handleUpdate({ recurringEnabled: checked })}
            />
          </div>

          {/* Recurrence Block */}
          {item.recurringEnabled && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              {/* Repeat Every */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`interval-${item.id}`} className="text-sm font-medium text-gray-900">
                    Повторять каждые
                  </Label>
                  <Input
                    id={`interval-${item.id}`}
                    type="number"
                    min="1"
                    value={item.recurrenceInterval}
                    onChange={(e) =>
                      handleUpdate({ recurrenceInterval: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`unit-${item.id}`} className="text-sm font-medium text-gray-900">
                    Период
                  </Label>
                  <Select
                    value={item.recurrenceUnit}
                    onValueChange={(value) =>
                      handleUpdate({ recurrenceUnit: value as any })
                    }
                  >
                    <SelectTrigger id={`unit-${item.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">День</SelectItem>
                      <SelectItem value="week">Неделя</SelectItem>
                      <SelectItem value="month">Месяц</SelectItem>
                      <SelectItem value="year">Год</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Until Date */}
              <div className="space-y-2">
                <Label htmlFor={`until-${item.id}`} className="text-sm font-medium text-gray-900">
                  До
                </Label>
                <Popover open={isUntilPickerOpen} onOpenChange={setIsUntilPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full h-11 px-4 rounded-lg border border-gray-300 bg-white",
                        "flex items-center justify-between",
                        "text-sm text-left",
                        "hover:border-gray-400 transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                        !item.recurrenceUntil && "text-gray-500"
                      )}
                    >
                      <span>{formatDate(item.recurrenceUntil)}</span>
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="p-0 bg-white" 
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    style={{ width: 'var(--radix-popover-trigger-width)' }}
                  >
                    <div className="bg-white p-3 sm:p-4">
                      <Calendar
                        size="compact"
                        value={untilDate}
                        onChange={handleUntilDateSelect}
                        disablePast={true}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
