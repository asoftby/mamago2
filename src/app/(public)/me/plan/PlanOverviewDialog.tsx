"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanItemCard } from "./PlanItemCard";
import type { SerializedPlanItem } from "./PlanPageClient";

const MONTHS_RU_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const DAYS_RU_FULL: Record<number, string> = {
  0: "Воскресенье",
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
};

function pluralizeEvents(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "событий";
  if (mod10 === 1) return "событие";
  if (mod10 >= 2 && mod10 <= 4) return "события";
  return "событий";
}

function formatGroupDate(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  return `${DAYS_RU_FULL[date.getDay()]}, ${date.getDate()} ${MONTHS_RU_GENITIVE[date.getMonth()]}`;
}

export function PlanOverviewDialog({
  open,
  onOpenChange,
  itemsByDate,
  totalItems,
  totalDays,
  onRemove,
  onOpenDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemsByDate: Record<string, SerializedPlanItem[]>;
  totalItems: number;
  totalDays: number;
  onRemove: (id: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const dates = Object.keys(itemsByDate)
    .filter((date) => (itemsByDate[date]?.length ?? 0) > 0)
    .sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(980px,calc(100vw-32px))] max-w-none overflow-hidden rounded-[24px] p-0">
        <DialogHeader className="border-b px-6 pb-5 pt-6 text-left sm:px-8 sm:pt-8">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "var(--primary)" }}
          >
            ● весь план
          </div>
          <DialogTitle
            className="font-sans text-[38px] font-normal leading-none tracking-[-0.025em] sm:text-[48px]"
            style={{ color: "#141210" }}
          >
            {totalItems} {pluralizeEvents(totalItems)}
          </DialogTitle>
          <p className="m-0 text-[14px]" style={{ color: "rgba(20,18,16,.55)" }}>
            Разложены по {totalDays} {totalDays === 1 ? "дню" : totalDays >= 2 && totalDays <= 4 ? "дням" : "дням"}.
            Выберите дату или откройте событие.
          </p>
        </DialogHeader>

        <div className="overflow-y-auto px-6 pb-8 pt-2 sm:px-8">
          {dates.length > 0 ? (
            <div className="flex flex-col gap-8">
              {dates.map((date) => {
                const dateItems = itemsByDate[date] ?? [];
                return (
                  <section key={date} className="pt-5">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-3">
                        <h3
                          className="font-sans text-[22px] font-normal tracking-[-0.015em] sm:text-[26px]"
                          style={{ margin: 0, color: "#141210" }}
                        >
                          {formatGroupDate(date)}
                        </h3>
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.1em]"
                          style={{ color: "rgba(20,18,16,.45)" }}
                        >
                          {dateItems.length} {pluralizeEvents(dateItems.length)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenDay(date)}
                        className="text-[12px] font-medium"
                        style={{ color: "#C24E22" }}
                      >
                        Открыть день →
                      </button>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {dateItems.map((item) => (
                        <PlanItemCard key={item.id} item={item} onRemove={onRemove} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="m-0 text-[15px]" style={{ color: "rgba(20,18,16,.55)" }}>
                В плане пока нет событий.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
