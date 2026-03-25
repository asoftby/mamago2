"use client";

import { Check } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

export function EventWhyGo({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <Section title="Почему стоит пойти" className={cn("py-8 md:py-10", className)}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((text, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 text-[14px] leading-relaxed text-foreground"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-3.5" strokeWidth={2.5} />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
