"use client";

import { Check } from "lucide-react";

interface EventHighlightsProps {
  items: string[];
}

/**
 * Блок "Что вас ждёт" - ключевые преимущества события.
 * Короткие буллеты (4-6 пунктов), сканируемо, без воды.
 */
export function EventHighlights({ items }: EventHighlightsProps) {
  if (items.length === 0) return null;

  return (
    <section className="border-t border-border/40 py-10">
      <h2 className="mb-6 font-headline text-2xl font-bold text-foreground">
        Что вас ждёт
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[15px] leading-relaxed text-foreground">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
