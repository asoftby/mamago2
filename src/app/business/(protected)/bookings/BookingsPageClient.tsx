"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  Filter,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  User2,
  Users,
  X,
} from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/features/notifications/store";
import type {
  BusinessBookingItem,
  BookingStatusCounts,
  WeekDayCount,
} from "@/server/services/booking/bookingQuery.service";

type StatusFilter = "all" | BookingStatus;
type SortMode = "newest" | "oldest";
type SummaryTone = "blue" | "orange" | "green" | "stone";

const DEFAULT_COUNTS: BookingStatusCounts = {
  all: 0,
  new: 0,
  confirmed: 0,
  completed: 0,
  rejected: 0,
};

const STATUS_META: Record<
  BookingStatus,
  {
    label: string;
    chipClass: string;
    railClass: string;
    metricClass: string;
    icon: typeof Clock3;
  }
> = {
  NEW: {
    label: "Новая",
    chipClass: "bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100",
    railClass: "bg-blue-500",
    metricClass: "text-blue-600",
    icon: Clock3,
  },
  CONFIRMED: {
    label: "Подтверждена",
    chipClass: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
    railClass: "bg-emerald-500",
    metricClass: "text-emerald-700",
    icon: CheckCheck,
  },
  COMPLETED: {
    label: "Завершена",
    chipClass: "bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200",
    railClass: "bg-stone-400",
    metricClass: "text-stone-700",
    icon: Check,
  },
  REJECTED: {
    label: "Отменена",
    chipClass: "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200",
    railClass: "bg-stone-300",
    metricClass: "text-stone-500",
    icon: CircleX,
  },
  CANCELLED: {
    label: "Отменена",
    chipClass: "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200",
    railClass: "bg-stone-300",
    metricClass: "text-stone-500",
    icon: CircleX,
  },
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
];

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

function formatAbsoluteDate(dateIso: string): string {
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "short",
  }).format(date);
}

function formatTime(dateIso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
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

function formatPriceLabel(booking: BusinessBookingItem): string | null {
  if (booking.offer?.priceFrom != null) {
    return `${booking.offer.priceFrom.toFixed(2).replace(".", ",")} BYN`;
  }
  if (booking.activity?.priceFrom != null) {
    return `${booking.activity.priceFrom.toFixed(2).replace(".", ",")} ${booking.activity.currency ?? "BYN"}`;
  }
  if (booking.offer?.priceText) return booking.offer.priceText;
  if (booking.activity?.priceText) return booking.activity.priceText;
  return null;
}

function buildOrderDetails(booking: BusinessBookingItem): string[] {
  const details: string[] = [];
  if (booking.campShiftTitle) {
    details.push(
      `${booking.campShiftTitle}${
        booking.campShiftDateFrom && booking.campShiftDateTo
          ? `: ${formatAbsoluteDate(booking.campShiftDateFrom)} — ${formatAbsoluteDate(booking.campShiftDateTo)}`
          : ""
      }`,
    );
  }
  if (booking.requestedDate) {
    details.push(
      `Дата записи: ${formatAbsoluteDate(booking.requestedDate)}${
        booking.requestedTime ? ` · ${booking.requestedTime}` : ""
      }`,
    );
  } else if (booking.session?.startsAt) {
    details.push(`Сеанс: ${formatAbsoluteDate(booking.session.startsAt)} · ${formatTime(booking.session.startsAt)}`);
  }
  const participants = [];
  if (booking.adultsCount > 0) participants.push(`${booking.adultsCount} взросл.`);
  if (booking.childrenCount > 0) participants.push(`${booking.childrenCount} ребёнок`);
  if (participants.length > 0) {
    details.push(`Участники: ${participants.join(" · ")}`);
  }
  return details;
}

function getSourceOptions(items: BusinessBookingItem[]) {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.display.title, item.display.title);
  }
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
}

function formatMetricHint(value: StatusFilter): string {
  if (value === "all") return "Всего заявок";
  if (value === BookingStatus.NEW) return "Нужно связаться";
  if (value === BookingStatus.CONFIRMED) return "Запланировано";
  if (value === BookingStatus.COMPLETED) return "За последние 30 дней";
  return "За последние 30 дней";
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
      label: "Нужно связаться с клиентом",
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

function getHistoryLabel(booking: BusinessBookingItem): string {
  if (booking.status === BookingStatus.CONFIRMED) {
    return "Заявка подтверждена и ожидает проведения.";
  }
  if (booking.status === BookingStatus.COMPLETED) {
    return "Услуга оказана, заявка завершена.";
  }
  if (booking.status === BookingStatus.REJECTED || booking.status === BookingStatus.CANCELLED) {
    return "Заявка закрыта без дальнейших действий.";
  }
  return formatReceivedLabel(booking.createdAt);
}

export function BookingsPageClient() {
  const [items, setItems] = useState<BusinessBookingItem[]>([]);
  const [counts, setCounts] = useState<BookingStatusCounts>(DEFAULT_COUNTS);
  const [weekCounts, setWeekCounts] = useState<WeekDayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusFilter>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [weekStart] = useState<Date>(() => getMonday(new Date()));
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Открыть конкретную заявку, если в URL есть ?id=
  useEffect(() => {
    const idFromUrl = searchParams.get("id");
    if (idFromUrl && items.length > 0) {
      setSelectedBookingId(idFromUrl);
    }
  }, [searchParams, items]);

  const refreshBusinessUnreadOnly = useNotificationStore(
    (s) => s.refreshBusinessUnreadOnly,
  );

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
        setWeekCounts(data.weekCounts ?? []);
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
    void fetchBookings({
      status: tab === "all" ? undefined : tab,
      date: selectedDate ?? undefined,
      weekStart,
    });
  }, [tab, selectedDate, weekStart, fetchBookings]);

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

        void fetchBookings({
          status: tab === "all" ? undefined : tab,
          date: selectedDate ?? undefined,
          weekStart,
        });
        void refreshBusinessUnreadOnly({ force: true });
      } catch (err) {
        void fetchBookings({
          status: tab === "all" ? undefined : tab,
          date: selectedDate ?? undefined,
          weekStart,
        });
        toast.error(err instanceof Error ? err.message : "Ошибка обновления");
      }
    },
    [fetchBookings, refreshBusinessUnreadOnly, selectedDate, tab, weekStart],
  );

  const sourceOptions = useMemo(() => getSourceOptions(items), [items]);

  const visibleItems = useMemo(() => {
    const filtered =
      sourceFilter === "all"
        ? items
        : items.filter((item) => item.display.title === sourceFilter);

    return [...filtered].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortMode === "newest" ? diff : -diff;
    });
  }, [items, sortMode, sourceFilter]);

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
    const todayRow = weekCounts.find((row) => row.date === todayKey);
    return [
      {
        key: "newToday",
        label: "Новых",
        value: todayRow?.newCount ?? 0,
        hint: "За сегодня",
        pill: todayRow?.newCount ? String(todayRow.newCount) : null,
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
  }, [counts, weekCounts]);

  const tabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: "all", label: "Все", count: counts.all },
    { value: BookingStatus.NEW, label: "Новые", count: counts.new },
    { value: BookingStatus.CONFIRMED, label: "Подтверждённые", count: counts.confirmed },
    { value: BookingStatus.COMPLETED, label: "Завершённые", count: counts.completed },
    { value: BookingStatus.REJECTED, label: "Отменённые", count: counts.rejected },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-stone-200/90 bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3 lg:grid-cols-5">
          {topStats.map((stat) => (
            <div
              key={stat.key}
              className="rounded-[22px] border border-stone-200 bg-white px-5 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]"
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
              <div className="mt-3 text-[2.05rem] font-semibold leading-none tracking-tight text-stone-950">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-stone-400">{stat.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-stone-200 bg-white px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 pb-4">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
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

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex h-12 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                <CalendarDays className="h-4 w-4 text-stone-400" />
                <input
                  type="date"
                  value={selectedDate ? toDateKey(selectedDate) : ""}
                  onChange={(event) =>
                    setSelectedDate(event.target.value ? new Date(event.target.value) : null)
                  }
                  className="min-w-[150px] bg-transparent outline-none"
                />
              </label>

              <label className="flex h-12 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                <Filter className="h-4 w-4 text-stone-400" />
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="min-w-[170px] bg-transparent outline-none"
                >
                  <option value="all">Все события</option>
                  {sourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex h-12 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <ArrowUpDown className="h-4 w-4 text-stone-400" />
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="min-w-[170px] bg-transparent outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingList />
        ) : visibleItems.length === 0 ? (
          <EmptyState hasFilter={tab !== "all" || selectedDate !== null || sourceFilter !== "all"} />
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
          )}
        >
          <CalendarDays className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-stone-500">{formatShortSchedule(booking)}</div>
          <div className="mt-1 line-clamp-2 text-[1.8rem] font-semibold leading-tight tracking-tight text-stone-950 sm:text-[2rem]">
            {booking.display.title}
          </div>
          <div className="mt-2 text-base text-stone-500">
            {booking.customerName} · {booking.customerPhone}
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
            <div className="text-[1.8rem] font-semibold leading-none tracking-tight text-stone-950 sm:text-[2rem]">
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

function BookingDetailsDrawer({
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
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!booking) return null;

  const meta = STATUS_META[booking.status];
  const action = getActionMeta(booking);
  const price = formatPriceLabel(booking);
  const details = buildOrderDetails(booking);
  const participant = getParticipantLabel(booking);
  const canConfirm = booking.status === BookingStatus.NEW;
  const canReject =
    booking.status === BookingStatus.NEW || booking.status === BookingStatus.CONFIRMED;
  const canComplete = booking.status === BookingStatus.CONFIRMED;

  const handleAction = async (status: BookingStatus) => {
    setUpdating(status);
    try {
      await onStatusChange(booking.id, status);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        overlayClassName="bg-black/20 backdrop-blur-sm"
        className={cn(
          "w-full gap-0 overflow-y-auto border-l-0 bg-white p-0",
          isDesktop
            ? "h-full border-l sm:max-w-[80vw] xl:max-w-[640px]"
            : "h-[92dvh] rounded-t-[28px] border-t",
          "data-[state=open]:duration-300 data-[state=closed]:duration-200",
        )}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Детали заявки</SheetTitle>
        <div className="min-h-full bg-white">
          <div className="mx-auto flex w-full max-w-[680px] flex-col p-4 sm:p-6">
            <aside className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 pb-6 pt-5 sm:px-7 sm:pt-7">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", meta.chipClass)}>
                      {meta.label}
                    </span>
                    {action ? (
                      <span className={cn("rounded-full px-3 py-1 text-sm font-medium", action.className)}>
                        {action.label}
                      </span>
                    ) : null}
                    <span className="text-sm text-stone-400">{formatReceivedLabel(booking.createdAt)}</span>
                  </div>
                  <h3 className="mt-5 text-[2rem] font-semibold leading-tight tracking-tight text-stone-950 sm:text-[2.25rem]">
                    {booking.display.title}
                  </h3>
                  <div className="mt-2 text-lg text-stone-500">{formatShortSchedule(booking)}</div>
                </div>

                <div className="flex shrink-0 items-start gap-3">
                  <div className="text-right">
                    <div className="text-[1.8rem] font-semibold leading-none tracking-tight text-stone-950 sm:text-[2.2rem]">
                      {price ?? "—"}
                    </div>
                    <div className="mt-2 text-sm text-stone-400">{booking.display.typeLabel}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onSelectPrev}
                      disabled={selectedIndex <= 0}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Предыдущая заявка"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={onSelectNext}
                      disabled={selectedIndex < 0 || selectedIndex >= total - 1}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Следующая заявка"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl text-stone-400 transition hover:bg-stone-50 hover:text-stone-700"
                      aria-label="Закрыть детали"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-stone-100 px-5 sm:px-7">
                <DetailSection
                  icon={<User2 className="h-5 w-5 text-blue-500" />}
                  label="Клиент"
                  primary={booking.customerName}
                  secondary={[booking.customerPhone, booking.customerEmail].filter(Boolean) as string[]}
                  trailing={
                    <div className="flex items-center gap-4 text-stone-400">
                      <a href={`tel:${booking.customerPhone}`} className="hover:text-stone-700">
                        <Phone className="h-5 w-5" />
                      </a>
                      {booking.customerEmail ? (
                        <a href={`mailto:${booking.customerEmail}`} className="hover:text-stone-700">
                          <Mail className="h-5 w-5" />
                        </a>
                      ) : (
                        <MessageCircle className="h-5 w-5" />
                      )}
                    </div>
                  }
                />

                {participant ? (
                  <DetailSection
                    icon={<Users className="h-5 w-5 text-orange-500" />}
                    label="Участник"
                    primary={participant}
                    secondary={booking.display.meta ? [`Особенности: ${booking.display.meta}`] : ["Особенности: нет"]}
                  />
                ) : null}

                <DetailSection
                  icon={<CalendarDays className="h-5 w-5 text-orange-500" />}
                  label="Детали заказа"
                  primary={details[0] ?? "Детали уточняются"}
                  secondary={details.slice(1)}
                />

                <DetailSection
                  icon={<Clock3 className="h-5 w-5 text-stone-500" />}
                  label="История статуса"
                  primary={meta.label}
                  secondary={[getHistoryLabel(booking)]}
                />

                {booking.customerComment ? (
                  <DetailSection
                    icon={<MessageCircle className="h-5 w-5 text-stone-500" />}
                    label="Комментарий клиента"
                    primary={booking.customerComment}
                  />
                ) : null}
              </div>

              <div className="px-5 pb-5 pt-6 sm:px-7 sm:pb-7">
                <div className="flex flex-wrap items-center gap-3">
                  {canConfirm ? (
                    <ActionButton
                      label="Подтвердить заявку"
                      tone="primary"
                      loading={updating === BookingStatus.CONFIRMED}
                      onClick={() => handleAction(BookingStatus.CONFIRMED)}
                    />
                  ) : null}
                  {canComplete ? (
                    <ActionButton
                      label="Завершить"
                      tone="secondary"
                      loading={updating === BookingStatus.COMPLETED}
                      onClick={() => handleAction(BookingStatus.COMPLETED)}
                    />
                  ) : null}
                  <ActionLink href={`tel:${booking.customerPhone}`} label="Позвонить клиенту" />
                  {booking.customerEmail ? (
                    <ActionLink href={`mailto:${booking.customerEmail}`} label="Написать клиенту" />
                  ) : (
                    <ActionButton
                      label="Написать клиенту"
                      tone="secondary"
                      loading={false}
                      onClick={() => toast.message("Добавим чат с клиентом в следующем обновлении")}
                    />
                  )}
                  {canReject ? (
                    <ActionButton
                      label="Отклонить"
                      tone="ghost"
                      loading={updating === BookingStatus.REJECTED}
                      onClick={() => handleAction(BookingStatus.REJECTED)}
                    />
                  ) : null}
                </div>

                {booking.status === BookingStatus.NEW ? (
                  <div className="mt-6 rounded-[22px] border border-blue-100 bg-blue-50/70 px-5 py-4">
                    <div className="text-sm font-semibold text-blue-700">
                      Почему заявка в статусе «Новая»?
                    </div>
                    <p className="mt-2 text-sm leading-6 text-blue-900/75">
                      Клиент только что отправил заявку. Свяжитесь с ним, чтобы подтвердить участие
                      и ответить на вопросы.
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({
  icon,
  label,
  primary,
  secondary,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  primary: string;
  secondary?: string[];
  trailing?: ReactNode;
}) {
  return (
    <section className="flex items-start justify-between gap-4 py-6">
      <div className="flex min-w-0 gap-4">
        <div className="mt-1">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-stone-500">{label}</div>
          <div className="mt-3 text-[1.15rem] font-semibold leading-8 text-stone-900">
            {primary}
          </div>
          {secondary?.length ? (
            <div className="mt-2 space-y-1.5 text-base leading-7 text-stone-500">
              {secondary.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {trailing}
    </section>
  );
}

function ActionButton({
  label,
  tone,
  loading,
  onClick,
}: {
  label: string;
  tone: "primary" | "secondary" | "ghost";
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex h-14 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition",
        tone === "primary" && "bg-stone-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.22)] hover:bg-stone-800",
        tone === "secondary" && "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
        tone === "ghost" && "border border-stone-200 bg-white text-stone-500 hover:bg-stone-50",
        loading && "cursor-wait opacity-70",
      )}
    >
      {loading ? "Сохраняем..." : label}
    </button>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-14 items-center justify-center rounded-2xl border border-stone-200 bg-white px-6 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
    >
      {label}
    </a>
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
            Попробуйте выбрать другой статус, дату или событие.
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
