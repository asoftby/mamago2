"use client";

import { Heart } from "lucide-react";
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
  onPlan,
  isPlanned = false,
  priceLabel,
  hasPurchaseUrl = true,
  className,
}: {
  sessions: EventPageSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Открывает модалку сохранения — если передан, сердечко вызывает её */
  onPlan?: () => void;
  isPlanned?: boolean;
  priceLabel?: string;
  hasPurchaseUrl?: boolean;
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
            onPlan={onPlan}
            isPlanned={isPlanned}
            priceLabel={priceLabel}
            hasPurchaseUrl={hasPurchaseUrl}
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
  onPlan,
  isPlanned = false,
  priceLabel,
  hasPurchaseUrl = true,
}: {
  session: EventPageSession;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPlan?: () => void;
  isPlanned?: boolean;
  priceLabel?: string;
  hasPurchaseUrl?: boolean;
}) {
  const dow = getDayLabel(session.startsAt);
  const dateLabel = getDateLabel(session.startsAt);
  const timeLabel = getTimeLabel(session.startsAt);

  const handleHeartClick = () => {
    onSelect(session.id);
    onPlan?.();
  };

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
          <div className="flex items-center gap-[5px]">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
              {dow}
            </span>
            {isFirst && (
              <span className="flex items-center gap-[5px] text-[10px] font-medium uppercase tracking-[0.1em] text-[#C24E22]" style={{ fontFamily: "Menlo, monospace" }}>
                <span className="inline-block h-[3px] w-[3px] rounded-full bg-[#C24E22]" />
                ближайший
              </span>
            )}
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.01em] text-[#141210]">
            {dateLabel}
          </div>
          <div className="mt-1.5 text-[13px] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
            {timeLabel}{priceLabel && <> · {priceLabel}</>}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="ml-auto flex items-center gap-3">
          {hasPurchaseUrl && (
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-[#E86A3A] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#C24E22] active:translate-y-px"
            >
              Купить билет →
            </button>
          )}
          <button
            type="button"
            onClick={handleHeartClick}
            aria-label={isPlanned ? "В плане" : "Добавить в план"}
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-colors",
              isPlanned
                ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
                : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.45)] hover:border-[#141210] hover:text-[#141210]",
            )}
          >
            <Heart size={20} strokeWidth={1.75} className={isPlanned ? "fill-[#C24E22]" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
