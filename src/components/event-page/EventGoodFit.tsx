"use client";

import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

export function EventGoodFit({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <Section
      title="Кому подойдёт"
      subtitle="Подойдёт, если вы ищете"
      className={cn("py-8 md:py-10", className)}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((text, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-[14px] leading-relaxed text-foreground"
          >
            {text}
          </div>
        ))}
      </div>
    </Section>
  );
}
