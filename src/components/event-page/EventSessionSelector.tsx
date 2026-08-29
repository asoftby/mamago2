"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EventPageSession } from "@/lib/event/eventPageTypes";
import { SessionCard } from "@/components/shared/SessionCard";
import { renderPriceWithIcon } from "@/components/icons/BelarusianRubleIcon";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

const INITIAL_VISIBLE = 3;

function getDayLabel(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ru-RU", {
    weekday: "long",
    timeZone: DEFAULT_TZ,
  });
}

function getDateLabel(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: DEFAULT_TZ,
  });
}

function getTimeLabel(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TZ,
  });
}

/** Склонение: 1 сеанс / 2 сеанса / 5 сеансов */
function pluralizeSession(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  if (mod100 >= 11 && mod100 <= 14) return "сеансов";
  if (mod10 === 1) return "сеанс";
  if (mod10 >= 2 && mod10 <= 4) return "сеанса";
  return "сеансов";
}

export function EventSessionSelector({
  sessions,
  selectedId,
  onSelect,
  onPlan,
  onBook,
  isPlanned = false,
  priceLabel,
  purchaseUrl,
  buyLabel = "Купить билет",
  className,
}: {
  sessions: EventPageSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPlan?: () => void;
  /** Открыть модалку записи для конкретного сеанса */
  onBook?: (sessionId: string) => void;
  isPlanned?: boolean;
  priceLabel?: string;
  purchaseUrl?: string;
  buyLabel?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (sessions.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[18px] border border-dashed border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-5 py-7 text-center text-[15px] text-[rgba(20,18,16,0.55)]",
          className,
        )}
      >
        Расписание уточняется. Сохраните событие в идеи — сообщим, когда появятся слоты.
      </div>
    );
  }

  const hiddenCount = Math.max(0, sessions.length - INITIAL_VISIBLE);
  const showToggle = sessions.length > INITIAL_VISIBLE;
  const visibleSessions = expanded ? sessions : sessions.slice(0, INITIAL_VISIBLE);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {visibleSessions.map((s, idx) => {
        const isFirst = idx === 0;
        // Строим subtitle как ReactNode: время · цена (с SVG-символом рубля)
        const timeLabel = getTimeLabel(s.startsAt);
        const priceNode = priceLabel ? renderPriceWithIcon(priceLabel, { iconSize: "sm" }) : null;
        const subtitle = priceNode
          ? <>{timeLabel} · {priceNode}</>
          : timeLabel || undefined;

        const hasAction = !!purchaseUrl || !!onBook;
        return (
          <SessionCard
            key={s.id}
            kicker={getDayLabel(s.startsAt)}
            isNearest={isFirst}
            title={getDateLabel(s.startsAt)}
            subtitle={subtitle}
            primaryLabel={hasAction ? (purchaseUrl ? buyLabel : "Записаться") : undefined}
            primaryHref={purchaseUrl}
            onPrimary={() => { onSelect(s.id); if (onBook) onBook(s.id); }}
            onPlan={() => { onSelect(s.id); onPlan?.(); }}
            isPlanned={isPlanned && selectedId === s.id}
          />
        );
      })}

      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "self-start rounded-full border border-[rgba(20,18,16,0.18)] px-5 py-2.5",
            "text-[13px] font-medium text-[rgba(20,18,16,0.55)]",
            "transition-colors hover:border-[rgba(20,18,16,0.35)] hover:text-[#141210]",
          )}
        >
          {expanded
            ? "Скрыть"
            : `Показать ещё ${hiddenCount} ${pluralizeSession(hiddenCount)}`}
        </button>
      )}
    </div>
  );
}
