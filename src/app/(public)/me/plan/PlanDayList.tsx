"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CalendarDays, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { SerializedPlanItem } from "./PlanPageClient";

function formatDayTitle(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Сегодня";
  if (date.getTime() === tomorrow.getTime()) return "Завтра";

  return date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function PlanItemCard({
  item,
  onRemove,
}: {
  item: SerializedPlanItem;
  onRemove: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const title = item.activity?.title ?? item.title ?? "Активность";
  const image = item.activity?.coverImageUrl ?? item.coverImageUrl ?? null;
  const time = formatTime(item.startsAt);
  const unavailable =
    item.planAvailability === "business_disabled" ||
    item.planAvailability === "missing_activity";

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/save/plan?planItemId=${item.id}`, { method: "DELETE" });
      if (res.ok) {
        onRemove(item.id);
        toast("Убрано из плана", { duration: 2000 });
      }
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition-colors">
      {image ? (
        <img src={image} alt={title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-neutral-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 leading-tight line-clamp-1">{title}</p>
        {unavailable && (
          <p className="text-xs text-amber-700 mt-0.5">Снято с публикации</p>
        )}
        {time && <p className="text-xs text-neutral-500 mt-0.5">{time}</p>}
        {item.activity?.ageLabel && (
          <p className="text-xs text-neutral-400 mt-0.5">{item.activity.ageLabel}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {item.activityId && !unavailable && (
          <Link
            href={`/minsk/activity/${item.activityId}`}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
        <button
          onClick={handleRemove}
          disabled={removing}
          className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

type Props = {
  date: string;
  items: SerializedPlanItem[];
  onRemove: (id: string) => void;
};

export function PlanDayList({ date, items, onRemove }: Props) {
  const title = formatDayTitle(date);

  return (
    <div>
      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3 px-1">
        {title}
      </p>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <PlanItemCard key={item.id} item={item} onRemove={onRemove} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-5 py-5">
          <div className="flex items-start gap-3">
            <CalendarDays
              className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-neutral-700">
                Нет событий
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Добавьте событие, место или идею, чтобы собрать план дня
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
