"use client";

import { Package } from "lucide-react";

interface EventIncludesProps {
  items: string[];
}

/**
 * Блок "Что включено" - чётко закрывает вопрос "за что я плачу".
 * Показывает материалы, ингредиенты, сопровождение и т.д.
 */
export function EventIncludes({ items }: EventIncludesProps) {
  if (items.length === 0) return null;

  return (
    <section className="border-t border-border/40 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-headline text-2xl font-bold text-foreground">
          Что включено
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-xl border border-border/40 bg-accent/30 px-4 py-3"
          >
            <span className="mt-0.5 text-primary">•</span>
            <span className="text-[14px] leading-relaxed text-foreground">
              {item}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
