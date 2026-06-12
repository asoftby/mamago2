"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EventPageSimilar } from "@/lib/event/eventPageTypes";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

export function SimilarEventsSection({
  items,
  className,
}: {
  items: EventPageSimilar[];
  onPlan?: (id: string) => void;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-1 items-center gap-3.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
            05 — Похожие события
          </span>
          <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
        </div>
        <a
          href="#"
          className="shrink-0 text-[14px] text-[#3A332B] underline underline-offset-4 hover:text-[#141210]"
        >
          Все события →
        </a>
      </div>

      {/* 4-column grid */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {items.map((ev, i) => (
          <div
            key={ev.id}
            className="flex flex-col gap-3"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            {/* Image */}
            <div className="group relative overflow-hidden rounded-[14px] bg-[#E8E0D4]" style={{ aspectRatio: "4/5" }}>
              {ev.imageUrl.startsWith("http") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={ev.imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-[rgba(20,18,16,0.35)]">
                  Нет фото
                </div>
              )}
              {ev.dateLabel && (
                <span className="absolute left-2.5 top-2.5 inline-flex h-[26px] items-center rounded-full bg-[rgba(250,247,241,0.94)] px-2.5 text-[11px] font-medium backdrop-blur-[6px]">
                  {ev.dateLabel}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                Событие
              </div>
              <Link
                href={ev.href}
                className="line-clamp-2 text-[16px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#141210] hover:text-[#C24E22]"
              >
                {ev.title}
              </Link>
              {ev.priceLabel && (
                <div className="mt-1 font-mono text-[12px] text-[rgba(20,18,16,0.55)]">
                  {renderCurrencyText(normalizeUiCurrencyText(`от ${ev.priceLabel}`), { iconSize: "sm" })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
