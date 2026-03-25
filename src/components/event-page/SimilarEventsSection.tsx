"use client";

import Image from "next/image";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventPageSimilar } from "@/lib/event/eventPageTypes";

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
    <Section
      title="Похожие события"
      subtitle="Ещё идеи — после того как разобрались с этим"
      className={cn("py-8 md:py-12", className)}
    >
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((ev) => (
          <article
            key={ev.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
          >
            <Link href={ev.href} className="relative block aspect-[4/3] bg-muted">
              {ev.imageUrl.startsWith("http") ? (
                <Image
                  src={ev.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1200px) 25vw, 280px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Нет фото
                </div>
              )}
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">
                <Link href={ev.href} className="hover:underline">
                  {ev.title}
                </Link>
              </h3>
              <div className="text-[12px] text-muted-foreground">
                {[ev.dateLabel, ev.priceLabel].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" className="rounded-xl" asChild>
                  <Link href={ev.href}>Подробнее</Link>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => onPlan(ev.id)}
                >
                  В план
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
