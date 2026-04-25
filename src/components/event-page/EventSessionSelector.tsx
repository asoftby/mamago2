"use client";

import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/utils";
import type { EventPageSession } from "@/lib/event/eventPageTypes";
import { formatRuSessionSlot } from "@/lib/event/eventPageFormat";

export function EventSessionSelector({
  sessions,
  selectedId,
  onSelect,
  className,
}: {
  sessions: EventPageSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const titleOneOrUnknown = "Дата и время проведения";
  const titleMany = "Даты и время проведения события";

  if (sessions.length === 0) {
    return (
      <Section
        title={titleOneOrUnknown}
        className={cn("py-8 md:py-10", className)}
      >
        <p className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Расписание уточняется. Сохраните событие в идеи — сообщим, когда появятся слоты.
        </p>
      </Section>
    );
  }

  if (sessions.length === 1) {
    const s = sessions[0];
    return (
      <Section title={titleOneOrUnknown} className={cn("py-8 md:py-10", className)}>
        <div className="rounded-2xl border border-border/60 bg-card/60 px-5 py-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Сеанс
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {formatRuSessionSlot(s.startsAt)}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title={titleMany}
      subtitle="Слот влияет на напоминания и оформление в плане"
      className={cn("py-8 md:py-10", className)}
    >
      <div className="flex flex-col gap-2">
        {sessions.map((s) => {
          const active = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-[15px] transition-colors",
                active
                  ? "border-primary/40 bg-primary/8 font-medium text-foreground"
                  : "border-border/70 bg-background hover:bg-muted/40"
              )}
            >
              <span>{formatRuSessionSlot(s.startsAt)}</span>
              {active && (
                <span className="text-xs font-medium text-primary">Выбрано</span>
              )}
            </button>
          );
        })}
      </div>
    </Section>
  );
}
