"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import type { BookingProduct } from "./types";
import { BookingAvailabilityBadge } from "./BookingAvailabilityBadge";
import { BookingDateSelector } from "./BookingDateSelector";
import { BookingSlotSelector } from "./BookingSlotSelector";

interface BookingCardProps {
  product: BookingProduct;
  className?: string;
}

export function BookingCard({ product, className }: BookingCardProps) {
  const [selectedDateId, setSelectedDateId] = useState<string | null>(
    product.dates?.find(d => d.status !== 'sold-out')?.id || null
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const selectedDate = useMemo(
    () => product.dates?.find(d => d.id === selectedDateId),
    [product.dates, selectedDateId]
  );

  const selectedSlot = useMemo(
    () => selectedDate?.slots?.find(s => s.id === selectedSlotId),
    [selectedDate, selectedSlotId]
  );

  // Auto-select first available slot when date changes
  const handleDateChange = (dateId: string) => {
    setSelectedDateId(dateId);
    const date = product.dates?.find(d => d.id === dateId);
    const firstAvailableSlot = date?.slots?.find(s => s.status !== 'sold-out' && !s.disabled);
    setSelectedSlotId(firstAvailableSlot?.id || null);
  };

  const isCtaDisabled = useMemo(() => {
    if (product.mode === 'single') {
      return product.availabilityStatus === 'sold-out';
    }
    if (product.mode === 'multi-date') {
      return !selectedDateId || selectedDate?.status === 'sold-out';
    }
    if (product.mode === 'slots') {
      return !selectedSlotId || selectedSlot?.status === 'sold-out';
    }
    return false;
  }, [product.mode, product.availabilityStatus, selectedDateId, selectedDate, selectedSlotId, selectedSlot]);

  const currentAvailability = useMemo(() => {
    if (product.mode === 'single') {
      return {
        status: product.availabilityStatus!,
        remaining: undefined,
      };
    }
    if (product.mode === 'multi-date' && selectedDate) {
      return {
        status: selectedDate.status,
        remaining: selectedDate.remaining,
      };
    }
    if (product.mode === 'slots' && selectedSlot) {
      return {
        status: selectedSlot.status,
        remaining: selectedSlot.remaining,
      };
    }
    return null;
  }, [product.mode, product.availabilityStatus, selectedDate, selectedSlot]);

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="p-6 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{product.title}</h3>
          {product.subtitle && (
            <p className="text-sm text-gray-600 mt-1">{product.subtitle}</p>
          )}
          {product.meta && (
            <p className="text-xs text-gray-500 mt-1">{product.meta}</p>
          )}
        </div>

        {/* Price */}
        <div>
          <div className="text-2xl font-bold text-gray-900">{normalizeUiCurrencyText(product.priceLabel)}</div>
          {product.priceSubtext && (
            <p className="text-xs text-gray-500 mt-0.5">{normalizeUiCurrencyText(product.priceSubtext)}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6 space-y-4">
        {/* Single Event Mode */}
        {product.mode === 'single' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Дата:</span>
              <span className="font-medium text-gray-900">{product.singleDateLabel}</span>
            </div>
            {product.singleTimeLabel && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Время:</span>
                <span className="font-medium text-gray-900">{product.singleTimeLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Multi-Date Mode */}
        {product.mode === 'multi-date' && product.dates && (
          <BookingDateSelector
            dates={product.dates}
            selectedDateId={selectedDateId}
            onSelectDate={handleDateChange}
          />
        )}

        {/* Slots Mode */}
        {product.mode === 'slots' && product.dates && (
          <>
            <BookingDateSelector
              dates={product.dates}
              selectedDateId={selectedDateId}
              onSelectDate={handleDateChange}
            />
            {selectedDate?.slots && (
              <BookingSlotSelector
                slots={selectedDate.slots}
                selectedSlotId={selectedSlotId}
                onSelectSlot={setSelectedSlotId}
              />
            )}
          </>
        )}

        {/* Availability */}
        {currentAvailability && (
          <div className="pt-2">
            <BookingAvailabilityBadge
              status={currentAvailability.status}
              remaining={currentAvailability.remaining}
            />
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
          {product.ctaLabel}
        </button>
      </div>
    </div>
  );
}
