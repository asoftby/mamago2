"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EventPageSession } from "@/lib/event/eventPageTypes";

/** Derive a short day-of-week label from ISO date string. */
function getDayLabel(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("ru-RU", { weekday: "long" });
}

function getDateLabel(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function getTimeLabel(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

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
  if (sessions.length === 0) {
    return (
      <div className={cn("rounded-[18px] border border-dashed border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-5 py-7 text-center text-[15px] text-[rgba(20,18,16,0.55)]", className)}>
        Расписание уточняется. Сохраните событие в идеи — сообщим, когда появятся слоты.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {sessions.map((s, idx) => {
        const isFirst = idx === 0;
        const isSelected = selectedId === s.id;
        return (
          <SessionRow
            key={s.id}
            session={s}
            isFirst={isFirst}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

function SessionRow({
  session,
  isFirst,
  isSelected,
  onSelect,
}: {
  session: EventPageSession;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const [picked, setPicked] = useState(false);

  const dow = getDayLabel(session.startsAt);
  const dateLabel = getDateLabel(session.startsAt);
  const timeLabel = getTimeLabel(session.startsAt);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[18px] border px-6 py-5 transition-colors",
        isFirst
          ? "border-[rgba(232,106,58,0.25)] bg-gradient-to-b from-[#FFE8DC] to-[#FAF7F1]"
          : "border-[rgba(20,18,16,0.10)] bg-[#FAF7F1]",
      )}
    >
      {isFirst && (
        <span className="absolute right-4 top-4 text-[11px] font-medium uppercase tracking-[0.1em] text-[#C24E22]">
          ● ближайший
        </span>
      )}

      <div className="flex flex-wrap items-center gap-6">
        {/* Date column */}
        <div className="min-w-[180px]">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
            {dow}
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.01em] text-[#141210]">
            {dateLabel}
          </div>
          <div className="mt-1.5 font-mono text-[13px] text-[rgba(20,18,16,0.55)]">
            {timeLabel}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(session.id)}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-colors",
              isSelected
                ? "bg-[#141210] text-[#FAF7F1]"
                : "bg-[#E86A3A] text-white hover:bg-[#C24E22]",
            )}
          >
            {isSelected ? "Выбрано ✓" : "Купить билет →"}
          </button>
          <button
            type="button"
            onClick={() => { setPicked((p) => !p); onSelect(session.id); }}
            aria-label="В план"
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border text-[16px] transition-colors",
              picked
                ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
                : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.55)] hover:border-[#141210] hover:text-[#141210]",
            )}
          >
            {picked ? "✓" : "♥"}
          </button>
        </div>
      </div>
    </div>
  );
}
