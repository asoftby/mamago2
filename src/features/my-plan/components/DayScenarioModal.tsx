"use client";

import { useMemo } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import type { PlanItemWithActivity } from "../types/event";
import { ScenarioTimeline } from "./ScenarioTimeline";
import { ScenarioActionBar } from "./ScenarioActionBar";

interface DayScenarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  city: string;
  participantLabels: string[];
  items: PlanItemWithActivity[];
  layout?: "default" | "desktop";
  mode?: "owner" | "viewer";
  onApplyToMyPlan?: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const weekday = d.toLocaleDateString("ru-RU", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("ru-RU", { month: "long" });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} ${month}`;
}

function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function getCityName(citySlug: string): string {
  const cityNames: Record<string, string> = {
    minsk: "Минск",
    "marina-gorka": "Марьина Горка",
    moscow: "Москва",
    spb: "Санкт-Петербург",
  };
  return cityNames[citySlug] || citySlug;
}

export function DayScenarioModal({
  open,
  onOpenChange,
  date,
  city,
  participantLabels,
  items,
  layout = "default",
  mode = "owner",
  onApplyToMyPlan,
}: DayScenarioModalProps) {
  const isDesktop = layout === "desktop";

  const sortedItems = useMemo(() => {
    const uniqueItems = Array.from(new Map(items.map((item) => [item.id, item])).values());
    return [...uniqueItems].sort((a, b) => {
      const timeA = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      const timeB = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });
  }, [items]);

  const formattedDate = useMemo(() => formatDate(date), [date]);
  const cityName = useMemo(() => getCityName(city), [city]);

  const metaLine = useMemo(() => {
    if (sortedItems.length === 0) {
      return "Пока без событий";
    }
    const first = sortedItems.find((item) => item.startsAt)?.startsAt;
    const last = [...sortedItems].reverse().find((item) => item.startsAt)?.startsAt;
    const timeRange =
      first && last ? `${formatTime(first)}–${formatTime(last)}` : "в течение дня";
    return `${sortedItems.length} ${sortedItems.length === 1 ? "событие" : sortedItems.length < 5 ? "события" : "событий"} · ${timeRange}`;
  }, [sortedItems]);

  const handleShare = async () => {
    const text = [
      `Сценарий дня — ${formattedDate}, ${cityName}`,
      metaLine,
      participantLabels.length > 0 ? participantLabels.join(" + ") : null,
      "",
      ...sortedItems.map((item) => {
        const title = item.title || item.activity?.title || "Активность";
        return `${formatTime(item.startsAt) || "Без времени"} — ${title}`;
      }),
      "",
      "Собрано в mamaGo",
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Сценарий дня — ${formattedDate}`,
          text,
        });
        return;
      } catch {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Сценарий скопирован в буфер обмена");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const content = (
    <div className="flex h-full min-h-0 flex-col bg-[#FFF9F5]">
      <div className="flex-shrink-0 border-b border-neutral-200 bg-white/80 px-5 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold text-neutral-900">Сценарий дня</DialogTitle>
            <p className="mt-1 text-sm text-neutral-500">{formattedDate} · {cityName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
            {mode === "owner" ? (
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50"
                aria-label="Поделиться сценарием дня"
              >
                <Share2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <section className="rounded-[28px] border border-[#F8D7C7] bg-[linear-gradient(135deg,#FFF4EC_0%,#FFF9F6_48%,#FFFFFF_100%)] p-5 shadow-[0_12px_40px_-28px_rgba(239,135,89,0.6)]">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#BE4F2E]/75">
            Готово
          </p>
          <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-neutral-950">
            Ваш сценарий дня готов!
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{metaLine}</p>
          {participantLabels.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {participantLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-sm font-medium text-neutral-700"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <div className="mt-6">
          {sortedItems.length === 0 ? (
            <div className="rounded-[24px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900">Пока недостаточно событий</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                Добавьте хотя бы три активности, чтобы собрать красивый сценарий дня.
              </p>
            </div>
          ) : (
            <ScenarioTimeline items={sortedItems} />
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-neutral-200 bg-white px-5 py-4">
        <ScenarioActionBar mode={mode} onShare={handleShare} onApply={onApplyToMyPlan} />
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] overflow-hidden rounded-[32px] p-0 sm:max-w-4xl">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-[32px] p-0">
        {content}
      </SheetContent>
    </Sheet>
  );
}
