"use client";

import { cn } from "@/lib/utils";
import type { EventPageSession } from "@/lib/event/eventPageTypes";
import { SessionCard } from "@/components/shared/SessionCard";

function getDayLabel(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ru-RU", { weekday: "long" });
}

function getDateLabel(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTimeLabel(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventSessionSelector({
  sessions,
  selectedId,
  onSelect,
  onPlan,
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
  isPlanned?: boolean;
  priceLabel?: string;
  purchaseUrl?: string;
  buyLabel?: string;
  className?: string;
}) {
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

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {sessions.map((s, idx) => {
        const isFirst = idx === 0;
        const subtitle = [getTimeLabel(s.startsAt), priceLabel].filter(Boolean).join(" · ");
        return (
          <SessionCard
            key={s.id}
            kicker={getDayLabel(s.startsAt)}
            isNearest={isFirst}
            title={getDateLabel(s.startsAt)}
            subtitle={subtitle || undefined}
            primaryLabel={purchaseUrl ? buyLabel : undefined}
            primaryHref={purchaseUrl}
            onPrimary={() => onSelect(s.id)}
            onPlan={() => { onSelect(s.id); onPlan?.(); }}
            isPlanned={isPlanned && selectedId === s.id}
          />
        );
      })}
    </div>
  );
}
