"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, Phone, User, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { BookingStatus, PublicationType } from "@prisma/client";

type BookingStatusFilter = "all" | BookingStatus;

interface BookingRow {
  id: string;
  publicationType: PublicationType;
  status: BookingStatus;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerComment?: string | null;
  adultsCount: number;
  childrenCount: number;
  requestedDate?: string | null;
  requestedTime?: string | null;
  createdAt: string;
  activity?: {
    id: string;
    title: string;
    slug?: string | null;
  } | null;
  offer?: {
    id: string;
    title: string;
    slug?: string | null;
  } | null;
  place?: {
    id: string;
    title: string;
    slug?: string | null;
  } | null;
  session?: {
    id: string;
    startsAt: string;
  } | null;
}

interface WeekDayCount {
  date: string;
  total: number;
  newCount: number;
  confirmedCount: number;
}

interface BookingsResponse {
  items: BookingRow[];
  weekCounts?: WeekDayCount[];
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  NEW: "Новые",
  CONFIRMED: "Подтвержденные",
  REJECTED: "Отклоненные",
  CANCELLED: "Отмененные",
  COMPLETED: "Завершенные",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-stone-100 text-stone-800",
  COMPLETED: "bg-purple-100 text-purple-800",
};

const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  EVENT: "Событие",
  OFFER: "Предложение",
  PLACE: "Место",
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTH_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isSameDay(date1: Date, date2: Date): boolean {
  return formatDateKey(date1) === formatDateKey(date2);
}

function getWeekdayIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Convert Sunday=0 to Sunday=6, Monday=1 to Monday=0
}

export function BookingsPageClient() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [weekCounts, setWeekCounts] = useState<WeekDayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BookingStatusFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const fetchBookings = useCallback(async (status?: BookingStatus, date?: Date, weekStartDate?: Date) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }
      if (date) {
        params.set("date", formatDateKey(date));
      }
      if (weekStartDate) {
        params.set("weekStart", formatDateKey(weekStartDate));
      }
      const res = await fetch(`/api/business/bookings?${params}`, { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("API error:", res.status, errorData);
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as BookingsResponse;
      setBookings(data.items || []);
      if (data.weekCounts) {
        setWeekCounts(data.weekCounts);
      }
    } catch (error) {
      console.error("Fetch bookings error:", error);
      // Don't show error toast on first load, just log it
      if (bookings.length > 0) {
        toast.error("Ошибка загрузки заявок");
      }
    } finally {
      setLoading(false);
    }
  }, [bookings.length]);

  useEffect(() => {
    const status = tab === "all" ? undefined : tab;
    void fetchBookings(status, selectedDate || undefined, weekStart);
  }, [tab, selectedDate, weekStart, fetchBookings]);

  const updateBookingStatus = async (bookingId: string, newStatus: BookingStatus) => {
    setUpdatingId(bookingId);
    try {
      const res = await fetch(`/api/business/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json() as BookingRow;
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
      toast.success("Статус обновлен");
      // Refresh week counts
      void fetchBookings(tab === "all" ? undefined : tab, selectedDate || undefined, weekStart);
    } catch (error) {
      console.error("Update booking error:", error);
      toast.error("Ошибка обновления статуса");
    } finally {
      setUpdatingId(null);
    }
  };

  const getPublicationTitle = (booking: BookingRow): string => {
    if (booking.activity) return booking.activity.title;
    if (booking.offer) return booking.offer.title;
    if (booking.place) return booking.place.title;
    return "Без названия";
  };

  const getDateTimeDisplay = (booking: BookingRow): string => {
    if (booking.session) {
      const date = new Date(booking.session.startsAt);
      return date.toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (booking.requestedDate) {
      const date = new Date(booking.requestedDate);
      const dateStr = date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      });
      if (booking.requestedTime) {
        return `${dateStr}, ${booking.requestedTime}`;
      }
      return dateStr;
    }
    return "Без выбора времени";
  };

  const handlePrevWeek = () => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setWeekStart(newWeekStart);
    
    // Preserve weekday if date is selected
    if (selectedDate) {
      const weekdayIndex = getWeekdayIndex(selectedDate);
      const newSelectedDate = new Date(newWeekStart);
      newSelectedDate.setDate(newSelectedDate.getDate() + weekdayIndex);
      setSelectedDate(newSelectedDate);
    }
  };

  const handleNextWeek = () => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setWeekStart(newWeekStart);
    
    // Preserve weekday if date is selected
    if (selectedDate) {
      const weekdayIndex = getWeekdayIndex(selectedDate);
      const newSelectedDate = new Date(newWeekStart);
      newSelectedDate.setDate(newSelectedDate.getDate() + weekdayIndex);
      setSelectedDate(newSelectedDate);
    }
  };

  const handleDayClick = (date: Date) => {
    if (selectedDate && isSameDay(selectedDate, date)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  };

  const handleDatePickerChange = (date: Date | null) => {
    if (date) {
      const newWeekStart = getMonday(date);
      setWeekStart(newWeekStart);
      setSelectedDate(date);
      setIsDatePickerOpen(false);
    }
  };

  const getWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getWeekRange = (): string => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    const startMonth = MONTH_GENITIVE[weekStart.getMonth()];
    const endMonth = MONTH_GENITIVE[weekEnd.getMonth()];
    
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `с ${startDay} по ${endDay} ${endMonth}`;
    } else {
      return `с ${startDay} ${startMonth} по ${endDay} ${endMonth}`;
    }
  };

  const getDayCount = (date: Date): number => {
    const dateKey = formatDateKey(date);
    const count = weekCounts.find((c) => c.date === dateKey);
    return count?.total || 0;
  };

  const today = new Date();
  const weekDays = getWeekDays();
  const hasAnyBookings = bookings.length > 0 || weekCounts.some((c) => c.total > 0);

  if (loading) {
    return <div className="py-12 text-center text-sm text-stone-500">Загрузка…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 overflow-x-auto">
        {(["all", BookingStatus.NEW, BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.REJECTED] as BookingStatusFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              tab === t
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-100",
            )}
          >
            {t === "all" ? "Все" : STATUS_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Week Calendar */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft className="h-5 w-5 text-stone-600" />
          </button>
          
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "text-sm font-medium text-stone-900 transition-all",
                  "border-b-2 border-dashed border-[#EF8759]/40",
                  "hover:border-[#EF8759]/70 cursor-pointer",
                  "pb-0.5"
                )}
              >
                {getWeekRange()}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[360px] p-0" align="center">
              <div className="p-5">
                <DatePicker
                  value={selectedDate}
                  onDateChange={handleDatePickerChange}
                  disablePast={false}
                />
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={handleNextWeek}
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
            aria-label="Следующая неделя"
          >
            <ChevronRight className="h-5 w-5 text-stone-600" />
          </button>
        </div>

        {/* Week Days */}
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day, index) => {
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const count = getDayCount(day);
            const dayNum = day.getDate();

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "flex flex-col items-center justify-center py-5 px-4 rounded-xl transition-all",
                  "hover:bg-stone-50",
                  isSelected && "bg-[#EF8759] text-white hover:bg-[#EF8759]",
                  !isSelected && isToday && "bg-stone-100",
                )}
              >
                <span className={cn(
                  "text-sm font-medium mb-1.5",
                  isSelected ? "text-white" : "text-stone-500",
                )}>
                  {WEEKDAY_LABELS[index]}
                </span>
                <span className={cn(
                  "text-2xl font-semibold mb-1.5",
                  isSelected ? "text-white" : "text-stone-900",
                )}>
                  {dayNum}
                </span>
                {count > 0 && (
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    isSelected ? "bg-white/20 text-white" : "bg-[#EF8759]/15 text-[#C65D2E]",
                  )}>
                    •{count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <Calendar className="mb-3 h-12 w-12 text-stone-300" />
          {selectedDate ? (
            <>
              <p className="text-base font-medium text-stone-900 mb-1">На этот день заявок нет</p>
              <p className="text-sm text-stone-500 max-w-md">
                Выберите другой день недели или проверьте вкладку «Все».
              </p>
            </>
          ) : hasAnyBookings ? (
            <>
              <p className="text-base font-medium text-stone-900 mb-1">Заявок в этом фильтре нет</p>
              <p className="text-sm text-stone-500 max-w-md">
                Попробуйте выбрать другой статус или день недели.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-stone-900 mb-1">Заявок пока нет</p>
              <p className="text-sm text-stone-500 max-w-md">
                Когда клиенты будут записываться на ваши события, места или предложения, заявки появятся здесь.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isUpdating = updatingId === booking.id;
            const canConfirm = booking.status === BookingStatus.NEW;
            const canReject = booking.status === BookingStatus.NEW;
            const canComplete = booking.status === BookingStatus.CONFIRMED;

            return (
              <div
                key={booking.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                        {PUBLICATION_TYPE_LABELS[booking.publicationType]}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          STATUS_COLORS[booking.status],
                        )}
                      >
                        {STATUS_LABELS[booking.status]}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-stone-900 mb-1">
                      {getPublicationTitle(booking)}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-stone-600">
                      <Calendar className="h-4 w-4" />
                      <span>{getDateTimeDisplay(booking)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-stone-400">
                    {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true, locale: ru })}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-100">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-stone-400" />
                    <span className="text-sm text-stone-900 font-medium">{booking.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-stone-400" />
                    <a
                      href={`tel:${booking.customerPhone}`}
                      className="text-sm text-stone-900 hover:text-[#EF8759] transition-colors"
                    >
                      {booking.customerPhone}
                    </a>
                  </div>
                  {(booking.adultsCount > 0 || booking.childrenCount > 0) && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-stone-400" />
                      <span className="text-sm text-stone-600">
                        {booking.adultsCount > 0 && `${booking.adultsCount} взр.`}
                        {booking.adultsCount > 0 && booking.childrenCount > 0 && ", "}
                        {booking.childrenCount > 0 && `${booking.childrenCount} дет.`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Comment */}
                {booking.customerComment && (
                  <div className="pt-3 border-t border-stone-100">
                    <p className="text-sm text-stone-600 italic">"{booking.customerComment}"</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-stone-100 flex-wrap">
                  {canConfirm && (
                    <Button
                      size="sm"
                      onClick={() => void updateBookingStatus(booking.id, BookingStatus.CONFIRMED)}
                      disabled={isUpdating}
                      className="rounded-xl bg-green-600 hover:bg-green-700"
                    >
                      Подтвердить
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateBookingStatus(booking.id, BookingStatus.REJECTED)}
                      disabled={isUpdating}
                      className="rounded-xl"
                    >
                      Отклонить
                    </Button>
                  )}
                  {canComplete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateBookingStatus(booking.id, BookingStatus.COMPLETED)}
                      disabled={isUpdating}
                      className="rounded-xl"
                    >
                      Завершить
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="rounded-xl gap-2"
                  >
                    <a href={`tel:${booking.customerPhone}`}>
                      <Phone className="h-4 w-4" />
                      Позвонить
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
