"use client";

import { BookingChatButton, BookingChatCompose } from "@/components/business/bookings/BookingChatButton";
import type { ReactNode } from "react";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  Inbox,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/features/notifications/store";
import { formatPriceBr } from "@/lib/formatters/formatPriceBr";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import type {
  BusinessBookingItem,
  BookingStatusCounts,
} from "@/server/services/booking/bookingQuery.service";

type StatusFilter = "all" | BookingStatus;
type SortMode = "newest" | "oldest";
type CalendarViewMode = "month" | "week" | "day";
type SummaryTone = "blue" | "orange" | "green" | "stone";

type CalendarBookingBucket = {
  dateKey: string;
  bookings: BusinessBookingItem[];
  total: number;
  byStatus: Record<string, number>;
  statusDots: BookingStatus[];
};

type CalendarCell = {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
};

const DEFAULT_COUNTS: BookingStatusCounts = {
  all: 0,
  new: 0,
  confirmed: 0,
  completed: 0,
  rejected: 0,
};

const CALENDAR_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const STATUS_META: Record<
  BookingStatus,
  {
    label: string;
    shortLabel: string;
    chipClass: string;
    railClass: string;
    metricClass: string;
    dotClass: string;
    icon: typeof Clock3;
  }
> = {
  NEW: {
    label: "Новая",
    shortLabel: "Новая",
    chipClass: "bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100",
    railClass: "bg-blue-500",
    metricClass: "text-blue-600",
    dotClass: "bg-blue-500",
    icon: Clock3,
  },
  EXPIRED: {
    label: "Истекла",
    shortLabel: "Истекла",
    chipClass: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200",
    railClass: "bg-stone-300",
    metricClass: "text-stone-600",
    dotClass: "bg-stone-300",
    icon: CircleX,
  },
  CONFIRMED: {
    label: "Подтверждена",
    shortLabel: "Подтверждена",
    chipClass: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
    railClass: "bg-emerald-500",
    metricClass: "text-emerald-700",
    dotClass: "bg-emerald-500",
    icon: CheckCheck,
  },
  COMPLETED: {
    label: "Завершена",
    shortLabel: "Завершена",
    chipClass: "bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200",
    railClass: "bg-stone-400",
    metricClass: "text-stone-700",
    dotClass: "bg-stone-400",
    icon: Check,
  },
  REJECTED: {
    label: "Отменена",
    shortLabel: "Отменена",
    chipClass: "bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100",
    railClass: "bg-orange-400",
    metricClass: "text-stone-500",
    dotClass: "bg-orange-400",
    icon: CircleX,
  },
  CANCELLED: {
    label: "Отменена",
    shortLabel: "Отменена",
    chipClass: "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200",
    railClass: "bg-stone-300",
    metricClass: "text-stone-500",
    dotClass: "bg-stone-300",
    icon: CircleX,
  },
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
];

const STATUS_FILTER_PARAM: Record<StatusFilter, string> = {
  all: "all",
  NEW: "new",
  EXPIRED: "expired",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  REJECTED: "cancelled",
  CANCELLED: "cancelled",
};

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthGrid(anchor: Date): CalendarCell[] {
  const monthStart = getMonthStart(anchor);
  const weekDay = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - weekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      inCurrentMonth: date.getMonth() === anchor.getMonth(),
    };
  });
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCalendarHeaderDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatAbsoluteDate(dateIso: string): string {
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "short",
  }).format(date);
}

function formatDayShort(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatTime(dateIso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}

function parseStatusFilterParam(value: string | null): StatusFilter | null {
  if (!value || value === "all") return "all";
  if (value === "new") return BookingStatus.NEW;
  if (value === "expired") return BookingStatus.EXPIRED;
  if (value === "confirmed") return BookingStatus.CONFIRMED;
  if (value === "completed") return BookingStatus.COMPLETED;
  if (value === "cancelled") return BookingStatus.REJECTED;
  if (Object.values(BookingStatus).includes(value as BookingStatus)) {
    return value === BookingStatus.CANCELLED ? BookingStatus.REJECTED : (value as BookingStatus);
  }
  return null;
}

function getStatusFilterParam(value: StatusFilter): string | null {
  return value === "all" ? null : STATUS_FILTER_PARAM[value];
}

function getStatusFilterMatch(status: BookingStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === BookingStatus.REJECTED) {
    return status === BookingStatus.REJECTED || status === BookingStatus.CANCELLED;
  }
  return status === filter;
}

function isToday(dateIso: string): boolean {
  return toDateKey(new Date(dateIso)) === toDateKey(new Date());
}

function isYesterday(dateIso: string): boolean {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  return toDateKey(new Date(dateIso)) === toDateKey(day);
}

function formatReceivedLabel(dateIso: string): string {
  if (isToday(dateIso)) return `Заявка получена сегодня в ${formatTime(dateIso)}`;
  if (isYesterday(dateIso)) return `Заявка получена вчера в ${formatTime(dateIso)}`;
  return `Заявка получена ${formatAbsoluteDate(dateIso)} в ${formatTime(dateIso)}`;
}

function getBookingPrimaryDateKey(booking: BusinessBookingItem): string | null {
  if (booking.session?.startsAt) return toDateKey(new Date(booking.session.startsAt));
  if (booking.requestedDate) return toDateKey(new Date(booking.requestedDate));
  if (booking.campShiftDateFrom) return toDateKey(new Date(booking.campShiftDateFrom));
  return null;
}

function getBookingSortTimestamp(booking: BusinessBookingItem): number {
  const primary = booking.session?.startsAt ?? booking.requestedDate ?? booking.campShiftDateFrom ?? booking.createdAt;
  return new Date(primary).getTime();
}

function formatShortSchedule(booking: BusinessBookingItem): string {
  if (booking.session?.startsAt) {
    return `${formatAbsoluteDate(booking.session.startsAt)} · ${formatTime(booking.session.startsAt)}`;
  }
  if (booking.requestedDate) {
    return `${formatAbsoluteDate(booking.requestedDate)}${
      booking.requestedTime ? ` · ${booking.requestedTime}` : ""
    }`;
  }
  if (booking.campShiftDateFrom) {
    return `${formatAbsoluteDate(booking.campShiftDateFrom)}${
      booking.campShiftDateTo ? ` — ${formatAbsoluteDate(booking.campShiftDateTo)}` : ""
    }`;
  }
  return "Дата уточняется";
}

function formatPanelTime(booking: BusinessBookingItem): string {
  if (booking.session?.startsAt) return formatTime(booking.session.startsAt);
  if (booking.requestedTime) return booking.requestedTime.replace("-", "–");
  return "Время уточняется";
}

function formatPriceLabel(booking: BusinessBookingItem): string | null {
  if (booking.offer?.priceFrom != null) {
    return formatPriceBr(booking.offer.priceFrom, { from: true });
  }
  if (booking.activity?.priceFrom != null) {
    return formatPriceBr(booking.activity.priceFrom, { from: true });
  }
  if (booking.offer?.priceText) return normalizeUiCurrencyText(booking.offer.priceText);
  if (booking.activity?.priceText) return normalizeUiCurrencyText(booking.activity.priceText);
  return null;
}

function formatMetricHint(value: StatusFilter): string {
  if (value === "all") return "Всего заявок";
  if (value === BookingStatus.NEW) return "Нужно связаться";
  if (value === BookingStatus.CONFIRMED) return "Запланировано";
  if (value === BookingStatus.COMPLETED) return "За последние 30 дней";
  return "За последние 30 дней";
}

function formatBookingsCount(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return `${value} запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} записи`;
  return `${value} записей`;
}

function getActionMeta(booking: BusinessBookingItem): { label: string; className: string } | null {
  if (booking.status === BookingStatus.NEW) {
    if (!booking.session?.startsAt && !booking.requestedTime) {
      return {
        label: "Нужно выбрать время",
        className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
      };
    }
    return {
      label: "Ожидает подтверждения",
      className: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100",
    };
  }
  if (booking.status === BookingStatus.CONFIRMED && !booking.session?.startsAt) {
    return {
      label: "Ожидает подтверждения",
      className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100",
    };
  }
  return null;
}

function getParticipantLabel(booking: BusinessBookingItem): string | null {
  if (!booking.childName && booking.childAge == null) return null;
  return [booking.childName, booking.childAge != null ? `${booking.childAge} лет` : null]
    .filter(Boolean)
    .join(", ");
}

function buildCalendarBuckets(items: BusinessBookingItem[]): Map<string, CalendarBookingBucket> {
  const map = new Map<string, CalendarBookingBucket>();

  for (const booking of items) {
    const key = getBookingPrimaryDateKey(booking);
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.bookings.push(booking);
      existing.total += 1;
      existing.byStatus[booking.status] = (existing.byStatus[booking.status] ?? 0) + 1;
      if (existing.statusDots.length < 3 && !existing.statusDots.includes(booking.status)) {
        existing.statusDots.push(booking.status);
      }
      continue;
    }

    map.set(key, {
      dateKey: key,
      bookings: [booking],
      total: 1,
      byStatus: { [booking.status]: 1 },
      statusDots: [booking.status],
    });
  }

  for (const bucket of map.values()) {
    bucket.bookings.sort((a, b) => getBookingSortTimestamp(a) - getBookingSortTimestamp(b));
  }

  return map;
}

function getQuickDateItems(baseDate: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    const key = toDateKey(date);
    const label =
      index === 0
        ? `Сегодня · ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date)}`
        : index === 1
          ? `Завтра · ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date)}`
          : formatDayShort(date);
    return { key, date, label };
  });
}

export function BookingsPageClient({ revision = 0 }: { revision?: number } = {}) {
  const [items, setItems] = useState<BusinessBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusFilter>("all");
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [activeListDate, setActiveListDate] = useState<Date | null>(null);
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement | null>(null);

  const refreshBusinessUnreadOnly = useNotificationStore(
    (s) => s.refreshBusinessUnreadOnly,
  );

  const updateSearchParams = useCallback(
    (params: { date?: string | null; status?: string | null; sort?: string | null }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (params.date === undefined) {
        // no-op
      } else if (params.date) {
        next.set("date", params.date);
      } else {
        next.delete("date");
      }

      if (params.status === undefined) {
        // no-op
      } else if (params.status) {
        next.set("status", params.status);
      } else {
        next.delete("status");
      }

      if (params.sort === undefined) {
        // no-op
      } else if (params.sort) {
        next.set("sort", params.sort);
      } else {
        next.delete("sort");
      }

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const statusFromUrl = parseStatusFilterParam(searchParams.get("status"));
    const sortFromUrl = searchParams.get("sort");
    const dateFromUrl = searchParams.get("date");

    if (statusFromUrl) {
      setTab(statusFromUrl);
    }

    if (sortFromUrl === "newest" || sortFromUrl === "oldest") {
      setSortMode(sortFromUrl);
    }

    if (dateFromUrl) {
      const parsed = startOfDay(fromDateKey(dateFromUrl));
      setSelectedDate(parsed);
      setActiveListDate(parsed);
      setMonthAnchor(parsed);
    } else {
      const today = startOfDay(new Date());
      setSelectedDate(today);
      setMonthAnchor(today);
      setActiveListDate(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const idFromUrl = searchParams.get("id");
    if (idFromUrl && items.length > 0) {
      setSelectedBookingId(idFromUrl);
    }
  }, [searchParams, items]);

  const fetchBookings = useCallback(
    async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/business/bookings", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          items: BusinessBookingItem[];
          counts: BookingStatusCounts;
        };
        setItems(data.items ?? []);
      } catch (err) {
        console.error("[BookingsPageClient] fetch error", err);
        toast.error("Не удалось загрузить заявки");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetch("/api/business/bookings/check-stale", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [refreshBusinessUnreadOnly]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings, revision]);

  const handleStatusChange = useCallback(
    async (id: string, status: BookingStatus) => {
      setItems((prev) => prev.map((booking) => (booking.id === id ? { ...booking, status } : booking)));

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
        setItems((prev) => prev.map((booking) => (booking.id === id ? updated : booking)));
        toast.success("Статус обновлён");

        void fetchBookings();
        void refreshBusinessUnreadOnly({ force: true });
      } catch (err) {
        void fetchBookings();
        toast.error(err instanceof Error ? err.message : "Ошибка обновления");
      }
    },
    [fetchBookings, refreshBusinessUnreadOnly],
  );

  const calendarBuckets = useMemo(() => buildCalendarBuckets(items), [items]);
  const selectedDateKey = toDateKey(selectedDate);
  const selectedDayBucket = calendarBuckets.get(selectedDateKey) ?? null;
  const monthGrid = useMemo(() => getMonthGrid(monthAnchor), [monthAnchor]);

  const counts = useMemo<BookingStatusCounts>(() => {
    const next = { ...DEFAULT_COUNTS };

    for (const item of items) {
      next.all += 1;
      if (item.status === BookingStatus.NEW) next.new += 1;
      if (item.status === BookingStatus.CONFIRMED) next.confirmed += 1;
      if (item.status === BookingStatus.COMPLETED) next.completed += 1;
      if (item.status === BookingStatus.REJECTED || item.status === BookingStatus.CANCELLED) {
        next.rejected += 1;
      }
    }

    return next;
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!getStatusFilterMatch(item.status, tab)) return false;
      if (activeListDate && getBookingPrimaryDateKey(item) !== toDateKey(activeListDate)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const diff = getBookingSortTimestamp(b) - getBookingSortTimestamp(a);
      return sortMode === "newest" ? diff : -diff;
    });
  }, [activeListDate, items, sortMode, tab]);

  useEffect(() => {
    if (selectedBookingId && !visibleItems.some((item) => item.id === selectedBookingId)) {
      setSelectedBookingId(null);
    }
  }, [selectedBookingId, visibleItems]);

  const selectedBooking = useMemo(
    () => visibleItems.find((item) => item.id === selectedBookingId) ?? null,
    [selectedBookingId, visibleItems],
  );

  const selectedIndex = selectedBooking
    ? visibleItems.findIndex((item) => item.id === selectedBooking.id)
    : -1;

  const topStats = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const todayBucket = calendarBuckets.get(todayKey);
    return [
      {
        key: "newToday",
        label: "Новых",
        value: todayBucket?.bookings.filter((item) => item.status === BookingStatus.NEW).length ?? 0,
        hint: "За сегодня",
        pill: todayBucket?.bookings.filter((item) => item.status === BookingStatus.NEW).length
          ? String(todayBucket.bookings.filter((item) => item.status === BookingStatus.NEW).length)
          : null,
        tone: "blue" as SummaryTone,
      },
      {
        key: BookingStatus.NEW,
        label: "Ожидают ответа",
        value: counts.new,
        hint: formatMetricHint(BookingStatus.NEW),
        pill: counts.new ? String(counts.new) : null,
        tone: "orange" as SummaryTone,
      },
      {
        key: BookingStatus.CONFIRMED,
        label: "Подтверждённых",
        value: counts.confirmed,
        hint: formatMetricHint(BookingStatus.CONFIRMED),
        pill: null,
        tone: "green" as SummaryTone,
      },
      {
        key: BookingStatus.COMPLETED,
        label: "Завершённых",
        value: counts.completed,
        hint: formatMetricHint(BookingStatus.COMPLETED),
        pill: null,
        tone: "stone" as SummaryTone,
      },
      {
        key: BookingStatus.REJECTED,
        label: "Отменённых",
        value: counts.rejected,
        hint: formatMetricHint(BookingStatus.REJECTED),
        pill: null,
        tone: "stone" as SummaryTone,
      },
    ] as const;
  }, [calendarBuckets, counts]);

  const tabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: "all", label: "Все", count: counts.all },
    { value: BookingStatus.NEW, label: "Новые", count: counts.new },
    { value: BookingStatus.CONFIRMED, label: "Подтверждённые", count: counts.confirmed },
    { value: BookingStatus.COMPLETED, label: "Завершённые", count: counts.completed },
    { value: BookingStatus.REJECTED, label: "Отменённые", count: counts.rejected },
  ];

  const quickDates = useMemo(() => getQuickDateItems(startOfDay(new Date())), []);
  const activeListDateKey = activeListDate ? toDateKey(activeListDate) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-stone-200/90 bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {topStats.map((stat) => (
            <div
              key={stat.key}
              className="min-w-0 rounded-[22px] border border-stone-200 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] sm:px-5"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
                <span>{stat.label}</span>
                {stat.pill ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      stat.tone === "blue" && "bg-blue-50 text-blue-600",
                      stat.tone === "orange" && "bg-orange-50 text-orange-600",
                      stat.tone === "green" && "bg-emerald-50 text-emerald-600",
                      stat.tone === "stone" && "bg-stone-100 text-stone-500",
                    )}
                  >
                    {stat.pill}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 break-words text-[1.75rem] font-semibold leading-none tracking-tight text-stone-950 sm:text-[2.05rem]">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-stone-400">{stat.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <BookingsCalendarOverview
        monthAnchor={monthAnchor}
        selectedDate={selectedDate}
        selectedDayBucket={selectedDayBucket}
        monthGrid={monthGrid}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrevMonth={() => setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
        onNextMonth={() => setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
        onToday={() => {
          const today = startOfDay(new Date());
          setSelectedDate(today);
          setMonthAnchor(today);
        }}
        onSelectDate={(date) => {
          const next = startOfDay(date);
          setSelectedDate(next);
          setMonthAnchor(next);
        }}
        calendarBuckets={calendarBuckets}
        onViewAllForDate={(date) => {
          const next = startOfDay(date);
          setSelectedDate(next);
          setActiveListDate(next);
          updateSearchParams({
            date: toDateKey(next),
            status: getStatusFilterParam(tab),
            sort: sortMode,
          });
          listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div className="space-y-4" ref={listRef}>
        <div className="rounded-[28px] border border-stone-200 bg-white px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.05)]">
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto border-b border-stone-100 px-1 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setTab(item.value);
                    updateSearchParams({
                      status: getStatusFilterParam(item.value),
                      date: activeListDate ? toDateKey(activeListDate) : null,
                      sort: sortMode,
                    });
                  }}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-stone-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                      : "text-stone-600 hover:bg-stone-100",
                  )}
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      active ? "bg-white/15 text-white" : "bg-stone-100 text-stone-500",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <QuickDateCarousel
              items={quickDates}
              activeDateKey={activeListDateKey}
              onSelectDate={(date) => {
                setActiveListDate(date);
                setSelectedDate(date);
                setMonthAnchor(date);
                updateSearchParams({
                  date: toDateKey(date),
                  status: getStatusFilterParam(tab),
                  sort: sortMode,
                });
              }}
              onReset={() => {
                setActiveListDate(null);
                updateSearchParams({
                  date: null,
                  status: getStatusFilterParam(tab),
                  sort: sortMode,
                });
              }}
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-stone-500">
                {activeListDate ? `Фильтр по дате: ${formatCalendarHeaderDate(activeListDate)}` : "Показаны все заказы"}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <OrderDatePicker
                  value={activeListDate}
                  onChange={(date) => {
                    setActiveListDate(date);
                    if (date) {
                      setSelectedDate(date);
                      setMonthAnchor(date);
                    }
                    updateSearchParams({
                      date: date ? toDateKey(date) : null,
                      status: getStatusFilterParam(tab),
                      sort: sortMode,
                    });
                  }}
                />
                <OrderSortSelect
                  value={sortMode}
                  onChange={(value) => {
                    setSortMode(value);
                    updateSearchParams({
                      date: activeListDate ? toDateKey(activeListDate) : null,
                      status: getStatusFilterParam(tab),
                      sort: value,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingList />
        ) : visibleItems.length === 0 ? (
          <EmptyState hasFilter={tab !== "all" || activeListDate !== null} />
        ) : (
          <div className="space-y-3">
            {visibleItems.map((booking) => (
              <BookingListItem
                key={booking.id}
                booking={booking}
                selected={booking.id === selectedBookingId}
                onClick={() => setSelectedBookingId(booking.id)}
              />
            ))}
          </div>
        )}
      </div>

      <BookingDetailsDrawer
        open={selectedBooking != null}
        booking={selectedBooking}
        selectedIndex={selectedIndex}
        total={visibleItems.length}
        onOpenChange={(open) => {
          if (!open) setSelectedBookingId(null);
        }}
        onSelectPrev={() => {
          if (selectedIndex > 0) setSelectedBookingId(visibleItems[selectedIndex - 1]!.id);
        }}
        onSelectNext={() => {
          if (selectedIndex >= 0 && selectedIndex < visibleItems.length - 1) {
            setSelectedBookingId(visibleItems[selectedIndex + 1]!.id);
          }
        }}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

function BookingsCalendarOverview({
  monthAnchor,
  selectedDate,
  selectedDayBucket,
  monthGrid,
  viewMode,
  onViewModeChange,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  calendarBuckets,
  onViewAllForDate,
}: {
  monthAnchor: Date;
  selectedDate: Date;
  selectedDayBucket: CalendarBookingBucket | null;
  monthGrid: CalendarCell[];
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDate: (date: Date) => void;
  calendarBuckets: Map<string, CalendarBookingBucket>;
  onViewAllForDate: (date: Date) => void;
}) {
  return (
    <div className="rounded-[28px] border border-stone-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 p-4 sm:p-5 lg:p-6">
          <BookingCalendarHeader
            monthAnchor={monthAnchor}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onToday={onToday}
          />
          <BookingMonthGrid
            cells={monthGrid}
            monthAnchor={monthAnchor}
            selectedDate={selectedDate}
            calendarBuckets={calendarBuckets}
            onSelectDate={onSelectDate}
          />
        </div>

        <div className="border-t border-stone-100 xl:border-l xl:border-t-0">
          <BookingCalendarDayPanel
            selectedDate={selectedDate}
            bucket={selectedDayBucket}
            onViewAll={() => onViewAllForDate(selectedDate)}
          />
        </div>
      </div>
    </div>
  );
}

function BookingCalendarHeader({
  monthAnchor,
  viewMode,
  onViewModeChange,
  onPrevMonth,
  onNextMonth,
  onToday,
}: {
  monthAnchor: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 text-stone-500 transition hover:bg-stone-50"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 text-stone-500 transition hover:bg-stone-50"
          aria-label="Следующий месяц"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-2">
          <div className="inline-flex items-center gap-1 text-lg font-semibold capitalize text-stone-950">
            <span>{formatMonthLabel(monthAnchor)}</span>
            <ChevronDown className="h-4 w-4 text-stone-400" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="hidden rounded-2xl border border-stone-200 bg-stone-50 p-1 sm:inline-flex">
          {(["month", "week", "day"] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              disabled={mode !== "month"}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                viewMode === mode
                  ? "bg-white text-stone-950 shadow-sm"
                  : "text-stone-500",
                mode !== "month" && "cursor-not-allowed opacity-50",
              )}
            >
              {mode === "month" ? "Месяц" : mode === "week" ? "Неделя" : "День"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onToday}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Сегодня
        </button>
      </div>
    </div>
  );
}

function BookingMonthGrid({
  cells,
  monthAnchor,
  selectedDate,
  calendarBuckets,
  onSelectDate,
}: {
  cells: CalendarCell[];
  monthAnchor: Date;
  selectedDate: Date;
  calendarBuckets: Map<string, CalendarBookingBucket>;
  onSelectDate: (date: Date) => void;
}) {
  const selectedKey = toDateKey(selectedDate);
  const todayKey = toDateKey(new Date());
  const mobileCells = cells.filter((cell) => cell.date.getMonth() === monthAnchor.getMonth());
  const selectedMobileDayRef = useRef<HTMLButtonElement | null>(null);
  const visibleMonthKey = `${monthAnchor.getFullYear()}-${monthAnchor.getMonth()}`;

  useEffect(() => {
    selectedMobileDayRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedKey, visibleMonthKey]);

  return (
    <>
      <div className="-mx-1 overflow-x-auto px-1 pb-2 sm:hidden" aria-label="Выбор дня месяца">
        <div className="flex w-max snap-x snap-mandatory gap-2">
          {mobileCells.map((cell) => {
            const bucket = calendarBuckets.get(cell.key);
            const isSelected = cell.key === selectedKey;
            const isTodayCell = cell.key === todayKey;
            return (
              <button
                key={cell.key}
                ref={isSelected ? selectedMobileDayRef : undefined}
                type="button"
                onClick={() => onSelectDate(cell.date)}
                className={cn(
                  "flex h-[72px] w-14 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border text-sm transition",
                  isSelected ? "border-sky-300 bg-sky-50 text-sky-800" : "border-stone-200 bg-white text-stone-700",
                )}
              >
                <span className="text-[11px] uppercase text-stone-400">{CALENDAR_WEEKDAYS[(cell.date.getDay() + 6) % 7]}</span>
                <span className={cn("mt-1 font-semibold", isTodayCell && "text-sky-600")}>{cell.date.getDate()}</span>
                <span className="mt-1 text-[10px] text-stone-400">{bucket?.total ? formatBookingsCount(bucket.total) : "—"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-[24px] border border-stone-200 sm:block">
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
        {CALENDAR_WEEKDAYS.map((day) => (
          <div key={day} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-500">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const bucket = calendarBuckets.get(cell.key);
          const isSelected = cell.key === selectedKey;
          const isTodayCell = cell.key === todayKey;

          return (
            <BookingCalendarDayCell
              key={cell.key}
              cell={cell}
              bucket={bucket}
              isSelected={isSelected}
              isToday={isTodayCell}
              onClick={() => onSelectDate(cell.date)}
              isCurrentMonth={cell.date.getMonth() === monthAnchor.getMonth()}
            />
          );
        })}
      </div>
      </div>
    </>
  );
}

function BookingCalendarDayCell({
  cell,
  bucket,
  isSelected,
  isToday,
  isCurrentMonth,
  onClick,
}: {
  cell: CalendarCell;
  bucket: CalendarBookingBucket | undefined;
  isSelected: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  onClick: () => void;
}) {
  const extraCount = bucket ? Math.max(0, bucket.total - Math.min(bucket.statusDots.length, 3)) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[112px] flex-col items-start justify-between border-r border-b border-stone-200 px-3 py-3 text-left transition hover:bg-sky-50/60",
        !isCurrentMonth && "bg-stone-50/60",
        isSelected && "bg-sky-50 ring-1 ring-inset ring-sky-200",
      )}
    >
      <span
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold",
          isToday ? "bg-sky-600 text-white" : "text-stone-900",
          !isCurrentMonth && !isToday && "text-stone-400",
        )}
      >
        {cell.date.getDate()}
      </span>

      <div className="w-full space-y-2">
        {bucket ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {bucket.statusDots.slice(0, 3).map((status) => (
                <span
                  key={`${cell.key}-${status}`}
                  className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[status].dotClass)}
                />
              ))}
              {extraCount > 0 ? (
                <span className="text-[11px] font-medium text-stone-400">+{extraCount}</span>
              ) : null}
            </div>
            <div className="text-xs text-stone-400">{formatBookingsCount(bucket.total)}</div>
          </>
        ) : (
          <div className="text-xs text-stone-300">Нет записей</div>
        )}
      </div>
    </button>
  );
}

function BookingCalendarDayPanel({
  selectedDate,
  bucket,
  onViewAll,
}: {
  selectedDate: Date;
  bucket: CalendarBookingBucket | null;
  onViewAll: () => void;
}) {
  const bookings = bucket?.bookings ?? [];
  const visible = bookings.slice(0, 5);
  const label = bookings.length === 0 ? "Нет записей" : formatBookingsCount(bookings.length);

  return (
    <div className="flex h-full min-h-[320px] flex-col p-4 sm:min-h-[580px] sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-950">{formatCalendarHeaderDate(selectedDate)}</h3>
          <p className="mt-1 text-sm text-stone-500">Записи выбранного дня</p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
          {label}
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CalendarDays className="h-10 w-10 text-stone-300" />
          <div className="mt-4 text-base font-semibold text-stone-700">На эту дату записей нет</div>
          <div className="mt-2 max-w-[260px] text-sm text-stone-400">Выберите другой день в календаре</div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex-1 space-y-3">
            {visible.map((booking) => (
              <div key={booking.id} className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex items-start gap-3">
                  <span className={cn("mt-1 h-10 w-1.5 rounded-full", STATUS_META[booking.status].railClass)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{formatPanelTime(booking)}</div>
                        <div className="mt-1 text-base font-semibold leading-tight text-stone-950">{booking.display.title}</div>
                      </div>
                      <div className="whitespace-nowrap text-sm font-semibold text-stone-900">
                        {formatPriceLabel(booking) ?? "—"}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-stone-500">
                      {booking.customerName} · {booking.customerPhone}{booking.source === "MANUAL" ? " · Добавлено вручную" : ""}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS_META[booking.status].chipClass)}>
                        {STATUS_META[booking.status].shortLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onViewAll}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Смотреть все за {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(selectedDate)}
          </button>
        </>
      )}
    </div>
  );
}

function QuickDateCarousel({
  items,
  activeDateKey,
  onSelectDate,
  onReset,
}: {
  items: Array<{ key: string; date: Date; label: string }>;
  activeDateKey: string | null;
  onSelectDate: (date: Date) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={onReset}
        className={cn(
          "min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-medium transition",
          activeDateKey == null
            ? "border-stone-900 bg-stone-900 text-white"
            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
        )}
      >
        Все даты
      </button>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelectDate(item.date)}
          className={cn(
            "min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition",
            activeDateKey === item.key
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function OrderDatePicker({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
}) {
  return (
    <label className="flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:w-auto">
      <CalendarDays className="h-4 w-4 text-stone-400" />
      <input
        type="date"
        value={value ? toDateKey(value) : ""}
        onChange={(event) => onChange(event.target.value ? startOfDay(fromDateKey(event.target.value)) : null)}
        className="min-w-0 flex-1 bg-transparent outline-none sm:min-w-[150px]"
      />
    </label>
  );
}

function OrderSortSelect({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (value: SortMode) => void;
}) {
  return (
    <label className="flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:w-auto">
      <ArrowUpDown className="h-4 w-4 text-stone-400" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortMode)}
        className="min-w-0 flex-1 bg-transparent outline-none sm:min-w-[170px]"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BookingListItem({
  booking,
  selected,
  onClick,
}: {
  booking: BusinessBookingItem;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[booking.status];
  const action = getActionMeta(booking);
  const participant = getParticipantLabel(booking);
  const price = formatPriceLabel(booking);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded-[28px] border border-stone-200 bg-white p-0 text-left shadow-[0_12px_38px_rgba(15,23,42,0.04)] transition",
        selected
          ? "border-stone-300 shadow-[0_20px_48px_rgba(15,23,42,0.09)]"
          : "hover:border-stone-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.07)]",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", meta.railClass)} />
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:gap-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
            booking.status === BookingStatus.NEW && "bg-blue-50 text-blue-500",
            booking.status === BookingStatus.CONFIRMED && "bg-emerald-50 text-emerald-500",
            booking.status === BookingStatus.COMPLETED && "bg-stone-100 text-stone-500",
            booking.status === BookingStatus.REJECTED && "bg-orange-50 text-orange-500",
            booking.status === BookingStatus.CANCELLED && "bg-stone-100 text-stone-500",
            booking.status === BookingStatus.EXPIRED && "bg-stone-100 text-stone-500",
          )}
        >
          <CalendarDays className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-stone-500">{formatShortSchedule(booking)}</div>
          <div className="mt-1 line-clamp-2 text-[1.4rem] font-semibold leading-tight tracking-tight text-stone-950 sm:text-[2rem]">
            {booking.display.title}
          </div>
          <div className="mt-2 text-base text-stone-500">
            {booking.customerName} · {booking.customerPhone}{booking.source === "MANUAL" ? " · Добавлено вручную" : ""}
          </div>
          {participant ? <div className="mt-1 text-sm text-stone-400">{participant}</div> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", meta.chipClass)}>
              {meta.label}
            </span>
            {action ? (
              <span className={cn("rounded-full px-3 py-1 text-sm font-medium", action.className)}>
                {action.label}
              </span>
            ) : null}
            <span className="text-sm text-stone-400">
              {formatReceivedLabel(booking.createdAt)
                .replace("Заявка ", "")
                .replace("получена ", "получено ")}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-end justify-between gap-4 lg:min-w-[150px] lg:flex-col lg:items-end">
          <div className="text-right">
            <div className="text-[1.8rem] font-semibold leading-none tracking-tight text-stone-950 whitespace-nowrap sm:text-[2rem]">
              {price ?? "—"}
            </div>
            <div className="mt-2 text-sm text-stone-400">{booking.display.typeLabel}</div>
          </div>
          <div className="flex items-center gap-2 text-stone-400">
            <span className="hidden text-sm font-medium text-stone-500 sm:inline">Открыть</span>
            <ChevronRight className="h-6 w-6" />
          </div>
        </div>
      </div>
    </button>
  );
}

function formatScheduleWithoutYear(booking: BusinessBookingItem): string {
  return formatShortSchedule(booking).replaceAll(` ${new Date().getFullYear()} г.`, "");
}

function formatHistoryTime(dateIso: string): string {
  const time = formatTime(dateIso);
  if (isToday(dateIso)) return `сегодня, ${time}`;
  if (isYesterday(dateIso)) return `вчера, ${time}`;
  return `${formatAbsoluteDate(dateIso)}, ${time}`;
}

function getParticipantsValue(booking: BusinessBookingItem): string {
  const parts: string[] = [];
  if (booking.adultsCount > 0) parts.push(`Взрослые: ${booking.adultsCount}`);
  if (booking.childrenCount > 0) {
    const legacy = booking.childName
      ? `${booking.childName}${booking.childAge != null ? ` (${booking.childAge})` : ""}`
      : null;
    parts.push(
      booking.childrenCount === 1 && legacy
        ? `Дети: ${legacy}`
        : `Дети: ${booking.childrenCount}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "Уточняется";
}

function buildHistoryEntries(booking: BusinessBookingItem): { time: string | null; label: string }[] {
  const entries: { time: string | null; label: string }[] = [
    { time: formatHistoryTime(booking.createdAt), label: "Заявка получена" },
  ];
  const closing: Partial<Record<BookingStatus, string>> = {
    [BookingStatus.CONFIRMED]: "Вы подтвердили",
    [BookingStatus.COMPLETED]: "Заявка завершена",
    [BookingStatus.REJECTED]: "Заявка отклонена",
    [BookingStatus.CANCELLED]: "Заявка отменена",
    [BookingStatus.EXPIRED]: "Срок подтверждения истёк",
  };
  const label = closing[booking.status];
  if (label) entries.push({ time: null, label });
  return entries;
}

export function BookingDetailsDrawer({
  open,
  booking,
  selectedIndex,
  total,
  onOpenChange,
  onSelectPrev,
  onSelectNext,
  onStatusChange,
}: {
  open: boolean;
  booking: BusinessBookingItem | null;
  selectedIndex: number;
  total: number;
  onOpenChange: (open: boolean) => void;
  onSelectPrev: () => void;
  onSelectNext: () => void;
  onStatusChange: (id: string, status: BookingStatus) => Promise<void>;
}) {
  const [updating, setUpdating] = useState<BookingStatus | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chat, setChat] = useState<{ bookingId: string; open: boolean }>({ bookingId: "", open: false });
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!booking) return null;
  const chatOpen = chat.open && chat.bookingId === booking.id;

  const meta = STATUS_META[booking.status];
  const action = getActionMeta(booking);
  const price = formatPriceLabel(booking);
  const isNew = booking.status === BookingStatus.NEW;
  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const canConfirm = isNew;
  const canReject = isNew || isConfirmed;
  const canComplete = isConfirmed;
  const history = buildHistoryEntries(booking);
  const showNav = isDesktop && total > 1;
  const chatHref = booking.customerEmail ? `mailto:${booking.customerEmail}` : null;
  const initial = (booking.customerName.trim().charAt(0) || "?").toUpperCase();

  const handleAction = async (status: BookingStatus) => {
    setUpdating(status);
    try {
      await onStatusChange(booking.id, status);
    } finally {
      setUpdating(null);
    }
  };

  const orderRows: { label: string; value: ReactNode }[] = [
    { label: "Когда", value: formatScheduleWithoutYear(booking) },
    ...(booking.campShiftTitle ? [{ label: "Смена", value: booking.campShiftTitle }] : []),
    { label: "Участники", value: getParticipantsValue(booking) },
    ...(booking.display.meta ? [{ label: "Особенности", value: booking.display.meta }] : []),
    { label: "Стоимость", value: price ? renderCurrencyText(price, { iconSize: "text" }) : "—" },
  ];

  const writeButtonClass =
    "inline-flex h-12 w-full items-center justify-center rounded-2xl border border-stone-300 bg-white px-6 text-[15px] font-semibold text-stone-950 transition hover:bg-stone-50";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setChat({ bookingId: booking.id, open: false });
        onOpenChange(next);
      }}
    >
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        overlayClassName="bg-black/20 backdrop-blur-sm"
        className={cn(
          "gap-0 overflow-hidden border-0 bg-white p-0",
          isDesktop
            ? "inset-y-3 right-3 h-auto w-[calc(100%-1.5rem)] sm:max-w-[580px] rounded-[28px] shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
            : "max-h-[92dvh] w-full rounded-t-[28px]",
          "data-[state=open]:duration-300 data-[state=closed]:duration-200",
        )}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Детали заявки</SheetTitle>
        {!isDesktop ? (
          <div className="flex shrink-0 justify-center pt-2.5" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-stone-300" />
          </div>
        ) : null}

        {chatOpen ? (
          <BookingChatCompose
            booking={booking}
            subtitle={booking.display.title}
            onBack={() => setChat({ bookingId: booking.id, open: false })}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold",
                isNew && "bg-[#FDE7DD] text-[#C2410C]",
                isConfirmed && "bg-emerald-100/80 text-emerald-700",
                !isNew && !isConfirmed && meta.chipClass,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {isNew ? "Новая · ждёт ответа" : meta.label}
            </span>
            <div className="flex items-center gap-1">
              {showNav ? (
                <>
                  <button
                    type="button"
                    onClick={onSelectPrev}
                    disabled={selectedIndex <= 0}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                    aria-label="Предыдущая заявка"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={onSelectNext}
                    disabled={selectedIndex < 0 || selectedIndex >= total - 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                    aria-label="Следующая заявка"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-100"
                aria-label="Закрыть детали"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <h3 className="mt-5 text-[1.6rem] font-bold leading-tight tracking-tight text-stone-950 sm:text-[1.75rem]">
            {booking.display.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[15px] text-stone-700">
              {formatScheduleWithoutYear(booking)}
              {price ? <span className="ml-3 font-semibold text-stone-950">{renderCurrencyText(price, { iconSize: "text" })}</span> : null}
            </span>
            <span className="text-[15px] text-stone-700">{booking.display.typeLabel}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-stone-500">
            <span>{formatReceivedLabel(booking.createdAt)}</span>
            {action?.label === "Нужно выбрать время" ? (
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", action.className)}>
                {action.label}
              </span>
            ) : null}
          </div>

          {isConfirmed ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 text-[15px] leading-snug text-emerald-800">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Запись подтверждена. Клиент получил уведомление.</span>
            </div>
          ) : null}

          <section className="mt-5 border-t border-stone-200 pt-5">
            <div className="text-[13px] text-stone-500">Клиент</div>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FDE7DD] text-lg font-semibold text-[#C2410C]">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[17px] font-semibold text-stone-950">
                  {booking.customerName}
                </div>
                <div className="mt-1 whitespace-nowrap font-mono text-[15px] text-stone-700">{booking.customerPhone}</div>
                {booking.source === "MANUAL" ? (
                  <div className="mt-0.5 text-xs text-stone-500">Добавлено вручную</div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <a
                  href={`tel:${booking.customerPhone}`}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 text-stone-800 transition hover:bg-stone-50"
                  aria-label="Позвонить клиенту"
                >
                  <Phone className="h-5 w-5" />
                </a>
                {booking.hasCustomerAccount ? (
                  <BookingChatButton booking={booking} iconOnly onCompose={() => setChat({ bookingId: booking.id, open: true })} />
                ) : chatHref ? (
                  <a
                    href={chatHref}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 text-stone-800 transition hover:bg-stone-50"
                    aria-label="Написать клиенту"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-5 border-t border-stone-200 pt-5">
            <div className="text-[13px] text-stone-500">Заказ</div>
            <dl className="mt-3 space-y-3.5">
              {orderRows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-base text-stone-500">{row.label}</dt>
                  <dd className="min-w-0 text-right text-base font-semibold text-stone-950">{row.value}</dd>
                </div>
              ))}
            </dl>
            {booking.customerComment ? (
              <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
                <div className="text-xs text-stone-500">Комментарий клиента</div>
                <div className="mt-1">{booking.customerComment}</div>
              </div>
            ) : null}
          </section>

          <section className="mt-5 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={() => setHistoryOpen((value) => !value)}
              aria-expanded={historyOpen}
              className="flex w-full items-center justify-between py-1 text-[14px] text-stone-500"
            >
              <span>История · {history.length}</span>
              <ChevronDown className={cn("h-5 w-5 transition-transform", historyOpen && "rotate-180")} />
            </button>
            {historyOpen ? (
              <ul className="mt-3 space-y-2.5">
                {history.map((entry) => (
                  <li key={entry.label} className="flex items-baseline gap-4 text-[15px]">
                    {entry.time ? (
                      <span className="shrink-0 font-mono text-[13px] text-stone-500">{entry.time}</span>
                    ) : null}
                    <span className="text-stone-950">{entry.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <div className="shrink-0 border-t border-stone-200 bg-white px-5 pb-5 pt-4 sm:px-6">
          {canConfirm ? (
            <div className="flex flex-col gap-1 md:flex-row-reverse md:items-center md:gap-4">
              <button
                type="button"
                onClick={() => handleAction(BookingStatus.CONFIRMED)}
                disabled={updating !== null}
                className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-stone-950 px-6 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-70 md:flex-1"
              >
                {updating === BookingStatus.CONFIRMED ? "Сохраняем..." : "Подтвердить заявку"}
              </button>
              <button
                type="button"
                onClick={() => handleAction(BookingStatus.REJECTED)}
                disabled={updating !== null}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl px-6 text-base font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-70 md:w-auto"
              >
                {updating === BookingStatus.REJECTED ? "Сохраняем..." : "Отклонить"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {booking.hasCustomerAccount ? (
                <BookingChatButton booking={booking} onCompose={() => setChat({ bookingId: booking.id, open: true })} />
              ) : chatHref ? (
                <a href={chatHref} className={writeButtonClass}>
                  Написать клиенту
                </a>
              ) : null}
              {canComplete || canReject ? (
                <div className="flex items-center justify-center gap-2">
                  {canComplete ? (
                    <button
                      type="button"
                      onClick={() => handleAction(BookingStatus.COMPLETED)}
                      disabled={updating !== null}
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-[15px] font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-wait disabled:opacity-70"
                    >
                      {updating === BookingStatus.COMPLETED ? "Сохраняем..." : "Завершить"}
                    </button>
                  ) : null}
                  {canReject ? (
                    <button
                      type="button"
                      onClick={() => handleAction(BookingStatus.REJECTED)}
                      disabled={updating !== null}
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-[15px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-70"
                    >
                      {updating === BookingStatus.REJECTED ? "Сохраняем..." : "Отклонить"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function LoadingList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-52 animate-pulse rounded-[28px] border border-stone-100 bg-stone-50"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-200 bg-white px-8 py-16 text-center shadow-[0_18px_55px_rgba(15,23,42,0.03)]">
      {hasFilter ? (
        <>
          <Inbox className="mx-auto h-10 w-10 text-stone-300" />
          <div className="mt-4 text-lg font-semibold text-stone-700">Заявок в этом фильтре нет</div>
          <div className="mt-2 text-sm text-stone-400">
            Попробуйте выбрать другой статус или дату.
          </div>
        </>
      ) : (
        <>
          <CalendarDays className="mx-auto h-10 w-10 text-stone-300" />
          <div className="mt-4 text-lg font-semibold text-stone-700">Заявок пока нет</div>
          <div className="mt-2 text-sm text-stone-400">
            Когда клиенты начнут отправлять заявки, они появятся здесь.
          </div>
        </>
      )}
    </div>
  );
}
