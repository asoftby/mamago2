"use client";

import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDown, ChevronUp, CheckCircle2, Phone, PlusCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingActivityRecord } from "@/server/services/booking/bookingActivity.service";

// ─── Activity labels ──────────────────────────────────────────────────────────

const STATUS_LABEL_RU: Record<string, string> = {
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
  COMPLETED: "Завершена",
};

function getActivityLabel(record: BookingActivityRecord): string {
  switch (record.type) {
    case "CREATED":
      return "Заявка создана";
    case "STATUS_CHANGED": {
      const to = (record.payload?.to as string) ?? "";
      return `Статус изменён: ${STATUS_LABEL_RU[to] ?? to}`;
    }
    case "PHONE_CLICKED":
      return "Телефон открыт";
    case "COMMENT_ADDED":
      return "Добавлен комментарий";
    default:
      return "Событие";
  }
}

function ActivityIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (type) {
    case "CREATED":
      return <PlusCircle className={cn(cls, "text-blue-500")} />;
    case "STATUS_CHANGED":
      return <CheckCircle2 className={cn(cls, "text-emerald-500")} />;
    case "PHONE_CLICKED":
      return <Phone className={cn(cls, "text-[#EF8759]")} />;
    case "COMMENT_ADDED":
      return <MessageSquare className={cn(cls, "text-stone-400")} />;
    default:
      return <div className={cn(cls, "rounded-full bg-stone-300")} />;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingHistoryProps {
  bookingId: string;
  /** Предзагруженные активности (опционально) */
  initialActivities?: BookingActivityRecord[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingHistory({ bookingId, initialActivities }: BookingHistoryProps) {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<BookingActivityRecord[] | null>(
    initialActivities ?? null,
  );
  const [loading, setLoading] = useState(false);

  const loadActivities = useCallback(async () => {
    if (activities !== null) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch(`/api/business/bookings/${bookingId}/activity`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { activities: BookingActivityRecord[] };
      setActivities(data.activities ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [bookingId, activities]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadActivities();
  };

  const hasActivities = activities && activities.length > 0;

  return (
    <div className="border-t border-stone-100">
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-stone-50/60"
        aria-expanded={open}
      >
        <span className="text-[12px] font-semibold uppercase tracking-wider text-stone-400">
          История
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        )}
      </button>

      {/* Timeline */}
      {open && (
        <div className="px-5 pb-4">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-stone-100" />
                  <div className="h-3 w-40 animate-pulse rounded bg-stone-100" />
                </div>
              ))}
            </div>
          ) : !hasActivities ? (
            <p className="text-[12px] text-stone-400">История пуста</p>
          ) : (
            <ol className="space-y-2.5">
              {activities.map((record, idx) => (
                <li key={record.id} className="flex items-start gap-2.5">
                  {/* Icon + vertical line */}
                  <div className="relative flex flex-col items-center">
                    <div className="mt-0.5">
                      <ActivityIcon type={record.type} />
                    </div>
                    {idx < activities.length - 1 && (
                      <div className="mt-1 h-full w-px bg-stone-100" style={{ minHeight: 12 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pb-1">
                    <span className="text-[12px] font-medium text-stone-700">
                      {getActivityLabel(record)}
                    </span>
                    <span className="ml-2 text-[11px] text-stone-400">
                      {formatDistanceToNow(new Date(record.createdAt), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
