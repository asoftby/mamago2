"use client";

import Link from "next/link";
import { CalendarPlus, Compass, Lightbulb } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

export function EventPlanDayCta({
  citySlug,
  nearbyHref,
  onPlan,
  onSave,
  className,
}: {
  citySlug: string;
  nearbyHref?: string;
  onPlan: () => void;
  onSave: () => void;
  className?: string;
}) {
  const nearby = nearbyHref ?? `/${citySlug}`;

  return (
    <Section
      title="Соберите день вокруг события"
      subtitle="mamaGo помогает не только найти, но и спланировать семейный день"
      className={cn("py-8 md:py-10", className)}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={onPlan}
          className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarPlus className="size-5" />
          </span>
          <span className="text-[15px] font-semibold leading-snug">Добавить в план</span>
          <span className="text-[13px] text-muted-foreground">
            Зафиксируйте время и напоминания.
          </span>
        </button>

        <button
          type="button"
          onClick={onSave}
          className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <Lightbulb className="size-5" />
          </span>
          <span className="text-[15px] font-semibold leading-snug">Сохранить как идею</span>
          <span className="text-[13px] text-muted-foreground">
            Вернётесь к событию, когда будет удобно.
          </span>
        </button>

        <Link
          href={nearby}
          className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-800 dark:text-sky-200">
            <Compass className="size-5" />
          </span>
          <span className="text-[15px] font-semibold leading-snug">Найти рядом</span>
          <span className="text-[13px] text-muted-foreground">
            Кафе, прогулки и ещё активности рядом.
          </span>
        </Link>
      </div>
    </Section>
  );
}
