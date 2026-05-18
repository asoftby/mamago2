"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EventPageSession } from "@/lib/event/eventPageTypes";
import { Heart } from "lucide-react";

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

const COLLAPSED_LIMIT = 3;

export function EventSessionSelector({
  sessions,
  selectedId,
  onSelect,
  onBuySession,
  onPlanSession,
  className,
}: {
  sessions: EventPageSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBuySession?: (session: EventPageSession) => void;
  onPlanSession?: (session: EventPageSession) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (sessions.length === 0) {
    return (
      <div className={cn("rounded-[18px] border border-dashed border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-5 py-7 text-center text-[15px] text-[rgba(20,18,16,0.55)]", className)}>
        Расписание уточняется. Сохраните событие в идеи — сообщим, когда появятся слоты.
      </div>
    );
  }

  const visible = expanded ? sessions : sessions.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = sessions.length - COLLAPSED_LIMIT;
  const hasMore = !expanded && hiddenCount > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {visible.map((s, idx) => (
        <SessionRow
          key={s.id}
          session={s}
          isFirst={idx === 0}
          isSelected={selectedId === s.id}
          onSelect={onSelect}
          onBuySession={onBuySession}
          onPlanSession={onPlanSession}
        />
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[rgba(20,18,16,0.18)] bg-transparent text-[14px] font-semibold text-[rgba(20,18,16,0.55)] transition-colors hover:border-[rgba(20,18,16,0.35)] hover:text-[#141210]"
        >
          Развернуть
          <span className="inline-flex h-6 items-center rounded-full border border-[rgba(20,18,16,0.18)] px-2.5 font-mono text-[11px]">
            +{hiddenCount}
          </span>
        </button>
      )}

      {expanded && sessions.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex h-12 w-full items-center justify-center text-[13px] font-medium text-[rgba(20,18,16,0.55)] transition-colors hover:text-[#141210]"
        >
          Свернуть ↑
        </button>
      )}
    </div>
  );
}

function SessionRow({
  session,
  isFirst,
  isSelected,
  onSelect,
  onBuySession,
  onPlanSession,
}: {
  session: EventPageSession;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onBuySession?: (session: EventPageSession) => void;
  onPlanSession?: (session: EventPageSession) => void;
}) {
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
      <div className="flex flex-wrap items-center gap-6">
        {/* Date column */}
        <div className="min-w-[180px]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
              {dow}
            </span>
            {isFirst && (
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#C24E22]">
                ● ближайший
              </span>
            )}
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
            onClick={() => {
              onSelect(session.id);
              onBuySession?.(session);
            }}
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
            onClick={() => {
              onSelect(session.id);
              onPlanSession?.(session);
            }}
            aria-label="В план"
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border transition-colors",
              isSelected
                ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
                : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.55)] hover:border-[#141210] hover:text-[#141210]",
            )}
          >
            <Heart className={cn("h-4 w-4", isSelected && "fill-[#C24E22]")} />
          </button>
        </div>
      </div>
    </div>
  );
}
