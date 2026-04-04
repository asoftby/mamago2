"use client";

import { Users } from "lucide-react";

interface EventAudienceProps {
  items: string[];
}

/**
 * Блок "Для кого это" / "Подойдёт, если вы".
 * Напрямую влияет на конверсию - помогает пользователю понять,
 * подходит ли ему это событие.
 */
export function EventAudience({ items }: EventAudienceProps) {
  if (items.length === 0) return null;

  return (
    <section className="border-t border-border/40 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-headline text-2xl font-bold text-foreground">
          Подойдёт, если вы
        </h2>
      </div>
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <span className="mt-1 text-primary">✓</span>
            <span className="text-[15px] leading-relaxed text-foreground">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
