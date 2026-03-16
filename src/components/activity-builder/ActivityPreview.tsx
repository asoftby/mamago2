"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ActivityFormData } from "./types";
import { BookingDateSelector } from "@/components/booking/BookingDateSelector";
import { BookingSlotSelector } from "@/components/booking/BookingSlotSelector";
import type { BookingDateOption } from "@/components/booking/types";

interface ActivityPreviewProps {
  data: ActivityFormData;
}

export function ActivityPreview({ data }: ActivityPreviewProps) {
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Convert schedule to booking format
  const bookingDates: BookingDateOption[] = useMemo(() => {
    return data.schedule.dates.map((date) => ({
      id: date.id,
      label: date.label.split(",")[0], // "18 марта"
      isoDate: date.isoDate,
      status: "available" as const,
      remaining: date.slots.reduce((sum, slot) => sum + slot.capacity, 0),
      slots: date.slots.map((slot) => ({
        id: slot.id,
        label: slot.startTime,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "available" as const,
        remaining: slot.capacity,
      })),
    }));
  }, [data.schedule]);

  // Auto-select first date
  useMemo(() => {
    if (bookingDates.length > 0 && !selectedDateId) {
      setSelectedDateId(bookingDates[0].id);
    }
  }, [bookingDates, selectedDateId]);

  const selectedDate = bookingDates.find((d) => d.id === selectedDateId);

  // Format price
  const priceLabel = useMemo(() => {
    if (data.pricingMode === "free") return "Бесплатно";
    if (data.pricingMode === "fixed") return `${data.price} BYN`;
    if (data.pricingMode === "from") return `от ${data.priceFrom} BYN`;
    if (data.pricingMode === "on-request") return "По запросу";
    return "";
  }, [data.pricingMode, data.price, data.priceFrom]);

  // Format CTA label
  const ctaLabel = useMemo(() => {
    if (data.ctaType === "book") return "Записаться";
    if (data.ctaType === "buy") return "Купить";
    if (data.ctaType === "request") return "Оставить заявку";
    if (data.ctaType === "details") return "Подробнее";
    return "Записаться";
  }, [data.ctaType]);

  // Format single date
  const formatSingleDate = (isoDate: string | null) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const isCtaDisabled = useMemo(() => {
    if (data.bookingMode === "none") return false;
    if (data.bookingMode === "request") return false;
    if (data.bookingMode === "single") return !data.singleDate;
    if (data.bookingMode === "multi-date") return !selectedDateId;
    if (data.bookingMode === "slots") return !selectedSlotId;
    return false;
  }, [data.bookingMode, data.singleDate, selectedDateId, selectedSlotId]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 space-y-3 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{data.title || "Название активности"}</h3>
          {data.description && (
            <p className="text-sm text-gray-600 mt-1">{data.description}</p>
          )}
          {(data.ageContext || data.duration) && (
            <p className="text-xs text-gray-500 mt-1">
              {[data.ageContext, data.duration].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>

        {/* Price */}
        <div>
          <div className="text-2xl font-bold text-gray-900">{priceLabel}</div>
          {data.pricingMode === "fixed" && (
            <p className="text-xs text-gray-500 mt-0.5">за {data.activityType === "event" ? "участие" : "занятие"}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-4">
        {/* Single Date Mode */}
        {data.bookingMode === "single" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Дата:</span>
              <span className="font-medium text-gray-900">
                {data.singleDate ? formatSingleDate(data.singleDate) : "Не выбрана"}
              </span>
            </div>
            {data.singleTime && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Время:</span>
                <span className="font-medium text-gray-900">{data.singleTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Multi-Date Mode */}
        {data.bookingMode === "multi-date" && bookingDates.length > 0 && (
          <BookingDateSelector
            dates={bookingDates}
            selectedDateId={selectedDateId}
            onSelectDate={setSelectedDateId}
          />
        )}

        {/* Slots Mode */}
        {data.bookingMode === "slots" && bookingDates.length > 0 && (
          <>
            <BookingDateSelector
              dates={bookingDates}
              selectedDateId={selectedDateId}
              onSelectDate={(id) => {
                setSelectedDateId(id);
                setSelectedSlotId(null);
              }}
            />
            {selectedDate?.slots && selectedDate.slots.length > 0 && (
              <BookingSlotSelector
                slots={selectedDate.slots}
                selectedSlotId={selectedSlotId}
                onSelectSlot={setSelectedSlotId}
              />
            )}
          </>
        )}

        {/* Empty State for Schedule */}
        {(data.bookingMode === "multi-date" || data.bookingMode === "slots") &&
          bookingDates.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">
                Добавьте даты в расписание
              </p>
            </div>
          )}
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <button
          type="button"
          disabled={isCtaDisabled}
          className={cn(
            "w-full h-11 px-4 rounded-lg text-sm font-medium transition-all",
            "focus:outline-none focus:ring-2 focus:ring-primary/20",
            isCtaDisabled
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          )}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
