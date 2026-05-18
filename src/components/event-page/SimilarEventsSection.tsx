"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EventPageSimilar } from "@/lib/event/eventPageTypes";

function EventCard({ ev }: { ev: EventPageSimilar }) {
  const hasImage = ev.imageUrl && !ev.imageUrl.endsWith("/og-default.jpg");

  return (
    <Link href={ev.href} className="group flex flex-col gap-3 focus:outline-none">
      {/* Image / placeholder */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-[#EDE8DF]"
        style={{ aspectRatio: "4/5" }}
      >
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={ev.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-[1000ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]"
          />
        ) : (
          /* Diagonal-stripe placeholder */
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 9px, rgba(20,18,16,0.07) 9px, rgba(20,18,16,0.07) 10px)",
            }}
          >
            {ev.categoryLabel && (
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[rgba(20,18,16,0.30)]">
                {ev.categoryLabel}
              </span>
            )}
          </div>
        )}

        {/* Date pill */}
        {ev.dateLabel && (
          <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-[rgba(250,247,241,0.92)] px-3 text-[12px] font-medium text-[#141210] shadow-[0_1px_4px_rgba(20,18,16,0.12)] backdrop-blur-[6px]">
            {ev.dateLabel}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex flex-col gap-1 px-0.5">
        {ev.categoryLabel && (
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
            {ev.categoryLabel}
          </div>
        )}
        <div className="line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#141210] transition-colors group-hover:text-[#C24E22]">
          {ev.title}
        </div>
        {(ev.priceLabel || ev.ageLabel) && (
          <div className="mt-0.5 font-mono text-[12px] text-[rgba(20,18,16,0.55)]">
            {ev.priceLabel && <span>от {ev.priceLabel}</span>}
            {ev.priceLabel && ev.ageLabel && <span className="mx-1.5">·</span>}
            {ev.ageLabel && <span>{ev.ageLabel}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

export function SimilarEventsSection({
  items,
  onPlan,
  className,
}: {
  items: EventPageSimilar[];
  onPlan: (id: string) => void;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-1 items-center gap-3.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
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

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
        {items.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </div>
    </div>
  );
}
