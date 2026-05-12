"use client";

import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, Phone, User, Baby, MessageSquare, Clock, AlertTriangle, BellDot } from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { BookingHistory } from "./BookingHistory";
import type { BusinessBookingItem } from "@/server/services/booking/bookingQuery.service";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<BookingStatus, string> = {
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
  COMPLETED: "Завершена",
};

type ChipTone = "neutral" | "muted" | "accent" | "success" | "warning" | "danger";

const STATUS_TONE: Record<BookingStatus, ChipTone> = {
  NEW: "accent",
  CONFIRMED: "success",
  REJECTED: "danger",
  CANCELLED: "muted",
  COMPLETED: "neutral",
};

// ─── SLA ─────────────────────────────────────────────────────────────────────

type SlaState = "ok" | "warning" | "danger";

function getSlaState(createdAt: string, status: BookingStatus): SlaState {
  if (status !== BookingStatus.NEW) return "ok";
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (ageHours >= 24) return "danger";
  if (ageHours >= 2) return "warning";
  return "ok";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: BusinessBookingItem;
  onStatusChange: (id: string, status: BookingStatus) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingCard({ booking, onStatusChange }: BookingCardProps) {
  const [updating, setUpdating] = useState<BookingStatus | null>(null);

  const isNew = booking.status === BookingStatus.NEW;
  const sla = getSlaState(booking.createdAt, booking.status);
  const { display, isStale, staleType } = booking;

  const handleAction = async (status: BookingStatus) => {
    setUpdating(status);
    try {
      await onStatusChange(booking.id, status);
    } finally {
      setUpdating(null);
    }
  };

  // Phone click tracking — fire-and-forget
  const handlePhoneClick = useCallback(() => {
    fetch(`/api/business/bookings/${booking.id}/phone-click`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {/* silently ignore */});
  }, [booking.id]);

  const canConfirm = booking.status === BookingStatus.NEW;
  const canReject =
    booking.status === BookingStatus.NEW || booking.status === BookingStatus.CONFIRMED;
  const canComplete = booking.status === BookingStatus.CONFIRMED;
  const isAnyUpdating = updating !== null;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white transition-shadow",
        isNew
          ? "border-blue-200 bg-blue-50/30 shadow-[0_1px_3px_rgba(59,130,246,0.08)] hover:shadow-[0_4px_16px_rgba(59,130,246,0.12)]"
          : "border-stone-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.07)]",
        sla === "danger" && "border-red-200 bg-red-50/20",
        isStale && staleType === "BOOKING_NEEDS_ATTENTION" && "border-violet-200 bg-violet-50/20",
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Chips row */}
          <div className="flex flex-wrap items-center gap-2">
            {isNew && (
              <span aria-label="Новая заявка" className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
            )}
            <BusinessChip tone={STATUS_TONE[booking.status]} size="compact">
              {STATUS_LABEL[booking.status]}
            </BusinessChip>
            {/* Type label from display — extensible for any source type */}
            <BusinessChip tone="warning" size="compact">
              {display.typeLabel}
            </BusinessChip>
            {sla === "danger" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Ждёт &gt;24ч
              </span>
            )}
            {sla === "warning" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                <Clock className="h-3 w-3" />
                Ждёт &gt;2ч
              </span>
            )}
            {/* Stale label — shown when SLA is ok but booking is stale (CONFIRMED without activity) */}
            {isStale && staleType === "BOOKING_NEEDS_ATTENTION" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                <BellDot className="h-3 w-3" />
                Требует внимания
              </span>
            )}
          </div>

          {/* Title from display */}
          <h3 className="text-[15px] font-semibold text-stone-900 leading-snug">
            {display.title}
          </h3>

          {/* Subtitle from display (shift dates, event time, etc.) */}
          {display.subtitle && (
            <div className="flex items-center gap-1.5 text-[13px] text-[#EF8759]">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{display.subtitle}</span>
            </div>
          )}

          {/* Meta from display (child info, etc.) */}
          {display.meta && (
            <p className="text-[13px] text-stone-500">{display.meta}</p>
          )}
        </div>

        {/* Created at */}
        <span className="shrink-0 text-[11px] text-stone-400 pt-0.5 whitespace-nowrap">
          {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true, locale: ru })}
        </span>
      </div>

      {/* ── Customer info ── */}
      <div className="grid grid-cols-1 gap-2.5 border-t border-stone-100 px-5 py-4 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-stone-400" />
          <span className="text-[14px] font-medium text-stone-900 truncate">
            {booking.customerName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-stone-400" />
          <a
            href={`tel:${booking.customerPhone}`}
            className="text-[14px] text-stone-700 hover:text-[#EF8759] transition-colors"
          >
            {booking.customerPhone}
          </a>
        </div>

        {(booking.childName || booking.childAge != null) && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <Baby className="h-4 w-4 shrink-0 text-stone-400" />
            <span className="text-[14px] text-stone-700">
              {[
                booking.childName,
                booking.childAge != null ? `${booking.childAge} лет` : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* ── Comment ── */}
      {booking.customerComment && (
        <div className="flex items-start gap-2 border-t border-stone-100 px-5 py-3">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <p className="text-[13px] italic text-stone-500 leading-relaxed">
            &ldquo;{booking.customerComment}&rdquo;
          </p>
        </div>
      )}

      {/* ── History ── */}
      <BookingHistory bookingId={booking.id} key={`${booking.id}-${booking.status}`} />

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-4">
        <a
          href={`tel:${booking.customerPhone}`}
          onClick={handlePhoneClick}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5",
            "text-[13px] font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50",
          )}
        >
          <Phone className="h-3.5 w-3.5" />
          Позвонить
        </a>

        {canConfirm && (
          <ActionButton
            label="Подтвердить"
            loading={updating === BookingStatus.CONFIRMED}
            disabled={isAnyUpdating}
            tone="success"
            onClick={() => handleAction(BookingStatus.CONFIRMED)}
          />
        )}
        {canComplete && (
          <ActionButton
            label="Завершить"
            loading={updating === BookingStatus.COMPLETED}
            disabled={isAnyUpdating}
            tone="neutral"
            onClick={() => handleAction(BookingStatus.COMPLETED)}
          />
        )}
        {canReject && (
          <ActionButton
            label="Отклонить"
            loading={updating === BookingStatus.REJECTED}
            disabled={isAnyUpdating}
            tone="danger"
            onClick={() => handleAction(BookingStatus.REJECTED)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({
  label, loading, disabled, tone, onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  tone: "success" | "danger" | "neutral";
  onClick: () => void;
}) {
  const cls = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    danger: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    neutral: "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5",
        "text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        cls,
      )}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {label}…
        </span>
      ) : label}
    </button>
  );
}
