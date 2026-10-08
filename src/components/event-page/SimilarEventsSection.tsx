"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { EventCard } from "@/components/events/EventCard";
import type { EventPageSimilar } from "@/lib/event/eventPageTypes";

/**
 * Related-event surface uses the same canonical EventCard as city home and
 * "Куда пойти". No local card rendering, styles, price or save controls.
 */
export function SimilarEventsSection({
  items,
  className,
  allHref,
}: {
  items: EventPageSimilar[];
  onPlan?: (id: string) => void;
  className?: string;
  allHref?: string;
}) {
  if (!items.length) return null;

  return (
    <div className={cn("", className)}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-1 items-center gap-3.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
            05 — Похожие события
          </span>
          <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
        </div>
        {allHref ? (
          <Link
            href={allHref}
            className="shrink-0 text-[14px] text-[#3A332B] underline underline-offset-4 hover:text-[#141210]"
          >
            Все события →
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {items.map((ev) => (
          <EventCard
            key={ev.id}
            id={ev.id}
            title={ev.title}
            href={ev.href}
            imageUrl={ev.imageUrl}
            categoryLabel={ev.categoryLabel}
            metaLabel={[ev.ageLabel, ev.dateLabel].filter(Boolean).join(" · ") || undefined}
            priceLabel={ev.priceLabel}
            saveMeta={{}}
          />
        ))}
      </div>
    </div>
  );
}
