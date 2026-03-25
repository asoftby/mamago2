"use client";

import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

export function EventFactsGrid({
  facts,
  className,
}: {
  facts: { id: string; label: string; value: string }[];
  className?: string;
}) {
  if (!facts.length) return null;
  return (
    <Section
      title="Что важно знать"
      subtitle="Коротко о формате, возрасте и организационных деталях"
      className={cn("py-8 md:py-10", className)}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        {facts.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3"
          >
            <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {row.label}
            </dt>
            <dd className="text-[14px] leading-snug text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
