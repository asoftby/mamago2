"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Inbox } from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { BookingCard } from "./BookingCard";
import { BookingAnalyticsStrip } from "./BookingAnalyticsStrip";
import { BookingFeedbackSummary } from "./BookingFeedbackSummary";
import { useNotificationStore } from "@/features/notifications/store";
import type {
  BusinessBookingItem,
  BookingStatusCounts,
  WeekDayCount,
} from "@/server/services/booking/bookingQuery.service";

// ─── Constants ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | BookingStatus;

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTH_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const DEFAULT_COUNTS: BookingStatusCounts = {
  all: 0, new: 0, confirmed: 0, completed: 0, rejected: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateKey(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const s = weekStart.getDate();
  const e = end.getDate();
  const sm = MONTH_GEN[weekStart.getMonth()]!;
  const em = MONTH_GEN[end.getMonth()]!;
  return weekStart.getMonth() === end.getMonth()
    ? `${s}–${e} ${em}`
    : `${s} ${sm} – ${e} ${em}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingsPageClient() {
  const [items, setItems] = useState<BusinessBookingItem[]>([]);
  const [counts, setCounts] = useState<BookingStatusCounts>(DEFAULT_COUNTS);
  const [weekCounts, setWeekCounts] = useState<WeekDayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusFilter>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  // Auto-read: track if we've already marked notifications read this session
  const autoReadDoneRef = useRef(false);
  const refreshBusinessUnreadOnly = useNotificationStore(
    (s) => s.refreshBusinessUnreadOnly,
  );

  // ── Fetch ──
  const fetchBookings = useCallback(
    async (opts: { status?: BookingStatus; date?: Date; weekStart?: Date }) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (opts.status) qs.set("status", opts.status);
        if (opts.date) qs.set("date", toDateKey(opts.date));
        if (opts.weekStart) qs.set("weekStart", toDateKey(opts.weekStart));

        const res = await fetch(`/api/business/bookings?${qs}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          items: BusinessBookingItem[];
          counts: BookingStatusCounts;
          weekCounts?: WeekDayCount[];
        };
        setItems(data.items ?? []);
        setCounts(data.counts ?? DEFAULT_COUNTS);
        if (data.weekCounts) setWeekCounts(data.weekCounts);
      } catch (err) {
        console.error("[BookingsPageClient] fetch error", err);
        toast.error("Не удалось загрузить заявки");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ── Auto-read: mark BOOKING_CREATED notifications as read on page open ──
  useEffect(() => {
    if (autoReadDoneRef.current) return;
    autoReadDoneRef.current = true;

    // Fire-and-forget: mark booking notifications as seen
    fetch("/api/notifications/mark-booking-read", {
      method: "POST",
      credentials: "include",
    })
      .then(() => {
        // Refresh business unread badge (throttled, won't spam)
        void refreshBusinessUnreadOnly({ force: true });
      })
      .catch(() => {
        // Non-critical — silently ignore
      });

    // Fire-and-forget: lazy stale check — sends reminder notifications with dedup
    fetch("/api/business/bookings/check-stale", {
      method: "POST",
      credentials: "include",
    }).catch(() => {/* silently ignore */});
  }, [refreshBusinessUnreadOnly]);

  useEffect(() => {
    void fetchBookings({
      status: tab === "all" ? undefined : tab,
      date: selectedDate ?? undefined,
      weekStart,
    });
  }, [tab, selectedDate, weekStart, fetchBookings]);

  // ── Status update (optimistic) ──
  const handleStatusChange = useCallback(
    async (id: string, status: BookingStatus) => {
      // Optimistic update
      setItems((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b)),
      );

      try {
        const res = await fetch(`/api/business/bookings/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        const updated = (await res.json()) as BusinessBookingItem;
        setItems((prev) => prev.map((b) => (b.id === id ? updated : b)));
        toast.success("Статус обновлён");

        // Refresh counts + week counts after status change
        void fetchBookings({
          status: tab === "all" ? undefined : tab,
          date: selectedDate ?? undefined,
          weekStart,
        });

        // Refresh notification badge
        void refreshBusinessUnreadOnly({ force: true });
      } catch (err) {
        // Revert optimistic update
        void fetchBookings({
          status: tab === "all" ? undefined : tab,
          date: selectedDate ?? undefined,
          weekStart,
        });
        toast.error(err instanceof Error ? err.message : "Ошибка обновления");
      }
    },
    [fetchBookings, tab, selectedDate, weekStart, refreshBusinessUnreadOnly],
  );

  // ── Week navigation ──
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();

  // ── Tab definitions with live counts ──
  const TABS: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "Все", count: counts.all },
    { value: BookingStatus.NEW, label: "Новые", count: counts.new },
    { value: BookingStatus.CONFIRMED, label: "Подтверждённые", count: counts.confirmed },
    { value: BookingStatus.COMPLETED, label: "Завершённые", count: counts.completed },
    { value: BookingStatus.REJECTED, label: "Отклонённые", count: counts.rejected },
  ];

  // ── Render ──
  return (
    <div className="space-y-4">
      {/* ── Analytics strip ── */}
      <BookingAnalyticsStrip />

      {/* ── Feedback summary (shown only when feedbackCount > 0) ── */}
      <BookingFeedbackSummary />

      {/* ── Status tabs with counts ── */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors whitespace-nowrap",
              tab === t.value
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-100",
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  tab === t.value
                    ? "bg-white/20 text-white"
                    : t.value === BookingStatus.NEW
                      ? "bg-blue-100 text-blue-700"
                      : "bg-stone-100 text-stone-600",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Week calendar ── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        {/* Navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={prevWeek}
            aria-label="Предыдущая неделя"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-medium text-stone-700">
            {weekRangeLabel(weekStart)}
          </span>
          <button
            type="button"
            onClick={nextWeek}
            aria-label="Следующая неделя"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            const count =
              weekCounts.find((c) => c.date === toDateKey(day))?.total ?? 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setSelectedDate(isSelected ? null : new Date(day))
                }
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-3 transition-colors",
                  isSelected
                    ? "bg-[#EF8759] text-white"
                    : isToday
                      ? "bg-stone-100 text-stone-900"
                      : "text-stone-600 hover:bg-stone-50",
                )}
              >
                <span className="text-[11px] font-medium">{WEEKDAY_SHORT[idx]}</span>
                <span className="text-[18px] font-bold leading-none">{day.getDate()}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      isSelected
                        ? "bg-white/25 text-white"
                        : "bg-[#EF8759]/15 text-[#C65D2E]",
                    )}
                  >
                    {count}
                  </span>
                ) : (
                  <span className="h-[18px]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <EmptyState hasFilter={tab !== "all" || selectedDate !== null} />
      ) : (
        <div className="space-y-3">
          {items.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-2xl border border-stone-100 bg-stone-50"
        />
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
      {hasFilter ? (
        <>
          <Inbox className="mb-3 h-10 w-10 text-stone-300" />
          <p className="text-[15px] font-semibold text-stone-700">Заявок в этом фильтре нет</p>
          <p className="mt-1 text-[13px] text-stone-400">
            Попробуйте выбрать другой статус или день
          </p>
        </>
      ) : (
        <>
          <Calendar className="mb-3 h-10 w-10 text-stone-300" />
          <p className="text-[15px] font-semibold text-stone-700">Заявок пока нет</p>
          <p className="mt-1 max-w-xs text-[13px] text-stone-400">
            Когда клиенты запишутся на ваши предложения, заявки появятся здесь
          </p>
        </>
      )}
    </div>
  );
}
