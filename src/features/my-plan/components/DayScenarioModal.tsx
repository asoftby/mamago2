"use client";

import { useMemo } from "react";
import { Share2, Clock } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/components/ui/media-cover";
import { toast } from "sonner";
import type { PlanItemWithActivity } from "../types/event";
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import { formatActivityAddressLine } from "../lib/formatActivityAddress";

interface DayScenarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  city: string;
  audienceLabel: string;
  items: PlanItemWithActivity[];
  layout?: "default" | "desktop";
}

type TimeSlot = "morning" | "afternoon" | "evening";

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "Утро",
  afternoon: "День",
  evening: "Вечер",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const weekday = d.toLocaleDateString("ru-RU", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("ru-RU", { month: "long" });
  
  const weekdayCapitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${weekdayCapitalized}, ${day} ${month}`;
}

function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function getCityName(citySlug: string): string {
  const cityNames: Record<string, string> = {
    minsk: "Минск",
    moscow: "Москва",
    spb: "Санкт-Петербург",
  };
  return cityNames[citySlug] || citySlug;
}

function formatPrice(activity: NonNullable<PlanItemWithActivity["activity"]>): string | null {
  const text = activity.priceText?.trim();
  if (text) return text;
  if (activity.priceFrom === 0) return "Бесплатно";
  if (activity.priceFrom != null && !Number.isNaN(activity.priceFrom)) {
    const cur = (activity.currency || "BYN").trim();
    return `от ${activity.priceFrom} ${cur}`;
  }
  return null;
}

export function DayScenarioModal({
  open,
  onOpenChange,
  date,
  city,
  audienceLabel,
  items,
  layout = "default",
}: DayScenarioModalProps) {
  const isDesktop = layout === "desktop";

  const sortedItems = useMemo(() => {
    // Deduplicate items by id
    const uniqueItems = Array.from(
      new Map(items.map((item) => [item.id, item])).values()
    );
    
    return [...uniqueItems].sort((a, b) => {
      const timeA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const timeB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [items]);

  const formattedDate = useMemo(() => formatDate(date), [date]);
  const cityName = useMemo(() => getCityName(city), [city]);

  const handleShare = async () => {
    const text = generateShareText();
    
    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: `Сценарий дня — ${formattedDate}`,
          text: text,
        });
        // Success - don't show any toast
        return;
      } catch (err) {
        // User cancelled - don't show error
        return;
      }
    }
    
    // Fallback: copy to clipboard only if Web Share API is not available
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Сценарий скопирован в буфер обмена");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const generateShareText = (): string => {
    const lines = [
      `Сценарий дня — ${formattedDate}, ${cityName}`,
      audienceLabel,
      "",
    ];
    
    sortedItems.forEach((item) => {
      const time = formatTime(item.startsAt);
      const title = item.title || item.activity?.title || "Активность";
      lines.push(`${time} — ${title}`);
      
      // Add address if available
      if (item.activity) {
        const address = formatActivityAddressLine(item.activity);
        if (address) {
          lines.push(`  ${address}`);
        }
      }
      
      // Add price and link
      const priceAndAction: string[] = [];
      if (item.activity) {
        const price = formatPrice(item.activity);
        if (price) {
          priceAndAction.push(price);
        }
        
        const cta = resolveActivityParticipationCta(item.activity, city);
        if (cta) {
          priceAndAction.push(cta.href);
        }
      }
      
      if (priceAndAction.length > 0) {
        lines.push(`  ${priceAndAction.join(" · ")}`);
      }
      
      lines.push(""); // Empty line between items
    });
    
    lines.push("Собрано в mamaGo");
    
    return lines.join("\n");
  };

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-neutral-900">
              Сценарий дня
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {formattedDate} · {cityName}
            </p>
            <p className="mt-0.5 text-sm text-neutral-600">
              {audienceLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Share2 className="h-4 w-4" />
              Поделиться
            </button>
            <ModalCloseButton
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="mb-4 h-12 w-12 text-neutral-300" />
            <h3 className="text-lg font-semibold text-neutral-900">
              Пока недостаточно активностей для сценария
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              Добавьте хотя бы 2 активности, чтобы увидеть сценарий дня
            </p>
            <Button
              onClick={() => onOpenChange(false)}
              className="mt-6 rounded-full"
            >
              Добавить активность
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-neutral-200" />
            
            {/* Timeline items */}
            <div className="space-y-6">
              {sortedItems.map((item, index) => {
                const time = formatTime(item.startsAt);
                const title = item.title || item.activity?.title || "Активность";
                const category = item.activity?.eventCategory?.nameRu;
                const address = item.activity ? formatActivityAddressLine(item.activity) : null;
                const subtitle = address || category;
                const imageUrl = item.coverImageUrl || item.activity?.coverImageUrl;
                
                // Price and action
                const price = item.activity ? formatPrice(item.activity) : null;
                const cta = item.activity ? resolveActivityParticipationCta(item.activity, city) : null;

                return (
                  <div key={item.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                      <div className="h-3 w-3 rounded-full border-2 border-primary bg-white" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pb-2">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-primary">
                            {time}
                          </p>
                          <h3 className="mt-1 text-base font-semibold leading-snug text-neutral-900">
                            {title}
                          </h3>
                          {subtitle ? (
                            <p className="mt-1 text-sm text-neutral-500">
                              {subtitle}
                            </p>
                          ) : null}
                          
                          {/* Price and Action Line */}
                          {(price || cta) ? (
                            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-neutral-600">
                              {price ? <span>{price}</span> : null}
                              {price && cta ? <span>·</span> : null}
                              {cta ? (
                                cta.external ? (
                                  <a
                                    href={cta.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 hover:underline"
                                  >
                                    {cta.label === "Купить билет" ? "Купить" : cta.label === "Записаться" ? "Записаться" : "Выбрать время"} →
                                  </a>
                                ) : (
                                  <a
                                    href={cta.href}
                                    className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 hover:underline"
                                  >
                                    {cta.label === "Купить билет" ? "Купить" : cta.label === "Записаться" ? "Записаться" : "Выбрать время"} →
                                  </a>
                                )
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        
                        {imageUrl ? (
                          <div className="w-16 shrink-0">
                            <MediaCover
                              imageUrl={imageUrl}
                              alt={title}
                              ratio="1/1"
                              className="rounded-lg"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {sortedItems.length > 0 ? (
        <div className="flex-shrink-0 border-t border-neutral-200 bg-white px-5 py-4">
          <p className="text-center text-sm text-neutral-500">
            {sortedItems.length} {sortedItems.length === 1 ? "активность" : sortedItems.length < 5 ? "активности" : "активностей"}
          </p>
        </div>
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[min(90vh,720px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full"
          )}
          aria-describedby={undefined}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Сценарий дня</DialogTitle>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[90vh] max-h-[90vh] flex-col gap-0 p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}
