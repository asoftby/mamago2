"use client";

import { Button } from "@/components/ui/button";
import { CalendarDays, Clock } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { OfferScheduleItem, ShiftCtaContext } from "@/lib/offer/offerPageTypes";
import { SessionCard } from "@/components/shared/SessionCard";

interface OfferScheduleProps {
  type: "classes" | "shifts";
  items: OfferScheduleItem[];
  /** Для shifts — передаёт полный контекст смены */
  onShiftCta?: (ctx: ShiftCtaContext) => void;
  /** Для shifts — сохранить смену в план */
  onSaveShift?: (ctx: ShiftCtaContext) => void;
  /** Для classes — передаёт id строки */
  onItemCta?: (itemId: string) => void;
}

export function OfferSchedule({
  type,
  items,
  onShiftCta,
  onSaveShift,
  onItemCta,
}: OfferScheduleProps) {
  /** Помечаем «hot»-смену — первую открытую с минимальным процентом заполнения */
  const hotShiftId = useMemo(() => {
    if (type !== "shifts") return null;
    const candidates = items.filter((s) => {
      if (s.capacity === undefined || s.spotsLeft === undefined) return false;
      if (s.spotsLeft === 0) return false;
      const filled = 1 - s.spotsLeft / s.capacity;
      return filled > 0 && filled < 0.7;
    });
    if (candidates.length === 0) return null;
    return candidates.reduce((best, cur) => {
      const fb = 1 - (best.spotsLeft! / best.capacity!);
      const fc = 1 - (cur.spotsLeft! / cur.capacity!);
      return fc < fb ? cur : best;
    }).id;
  }, [type, items]);

  /** Ближайшая предстоящая смена — первая с датой не раньше сегодня */
  const nearestShiftId = useMemo(() => {
    if (type !== "shifts") return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parseDate = (s?: string | null) => {
      if (!s) return null;
      const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!m) return null;
      return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    };
    const upcoming = items
      .map((s) => ({ s, d: parseDate(s.dateFrom) }))
      .filter(({ d }) => d && d >= today)
      .sort((a, b) => a.d!.getTime() - b.d!.getTime());
    return upcoming[0]?.s.id ?? null;
  }, [type, items]);

  return (
    <section id="schedule" className="space-y-7 scroll-mt-24">
      {/* Editorial section header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3.5 mb-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-400">
              {type === "shifts" ? "Смены и стоимость" : "Расписание и стоимость"}
            </span>
            <span className="flex-1 h-px bg-gray-100 max-w-[180px]" />
          </div>
          <h2 className="tracking-[-0.02em] leading-[1] text-gray-900" style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 30 }}>
            Выбери своё{" "}
            <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "var(--primary)" }}>лето</span>.
          </h2>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptySchedule onCta={() => onItemCta?.("empty")} />
      ) : type === "shifts" ? (
        <ShiftsList
          items={items}
          onShiftCta={onShiftCta}
          onSaveShift={onSaveShift}
          hotShiftId={hotShiftId}
          nearestShiftId={nearestShiftId}
        />
      ) : (
        <ClassesTable items={items} onItemCta={onItemCta} />
      )}
    </section>
  );
}

/* ─────────────────────────────────────────
   Empty State
───────────────────────────────────────── */
function EmptySchedule({ onCta }: { onCta?: () => void }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <CalendarDays className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-[16px] font-semibold text-gray-700">Расписание и стоимость уточняются</p>
      <p className="mt-1 text-[14px] text-gray-400">Оставьте заявку — мы свяжемся с вами</p>
      <Button
        className="mt-5 h-11 rounded-full bg-[#EF8759] px-6 text-[14px] font-bold text-white hover:bg-[#e07848]"
        onClick={onCta}
      >
        Оставить заявку
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────
   Shifts (CAMP)
───────────────────────────────────────── */
function ShiftsList({
  items,
  onShiftCta,
  onSaveShift,
  hotShiftId,
  nearestShiftId,
}: {
  items: OfferScheduleItem[];
  onShiftCta?: (ctx: ShiftCtaContext) => void;
  onSaveShift?: (ctx: ShiftCtaContext) => void;
  hotShiftId: string | null;
  nearestShiftId: string | null;
}) {
  return (
    <div className="space-y-3.5">
      {items.map((item) => (
        <ShiftCard
          key={item.id}
          item={item}
          onShiftCta={onShiftCta}
          onSaveShift={onSaveShift}
          isNearest={item.id === nearestShiftId}
        />
      ))}
    </div>
  );
}

function ShiftCard({
  item,
  onShiftCta,
  onSaveShift,
  isNearest,
}: {
  item: OfferScheduleItem;
  onShiftCta?: (ctx: ShiftCtaContext) => void;
  onSaveShift?: (ctx: ShiftCtaContext) => void;
  isNearest?: boolean;
}) {
  const ctx: ShiftCtaContext = {
    shiftId: item.id,
    title: item.title,
    dateFrom: item.dateFrom,
    dateTo: item.dateTo,
    price: item.price,
    ageRange: item.ageRange,
  };

  const dateLabel =
    item.dateFrom && item.dateTo
      ? `${item.dateFrom} — ${item.dateTo}`
      : item.dateFrom ?? item.dateTo ?? null;

  const isFull = item.spotsLeft === 0;
  const ctaEnabled = item.ctaEnabled !== false && !isFull;

  const subtitle = [dateLabel, item.price].filter(Boolean).join(" · ") || undefined;

  return (
    <SessionCard
      kicker={item.ageRange}
      isNearest={isNearest}
      title={item.title ?? dateLabel ?? ""}
      subtitle={subtitle}
      primaryLabel={ctaEnabled ? (item.ctaLabel ?? "Записаться") : undefined}
      primaryDisabled={!ctaEnabled}
      onPrimary={() => onShiftCta?.(ctx)}
      onPlan={() => onSaveShift?.(ctx)}
    />
  );
}

/* ─────────────────────────────────────────
   Classes (REGULAR) — без изменений по логике, чуть подправлены радиусы
───────────────────────────────────────── */
function ClassesTable({
  items,
  onItemCta,
}: {
  items: OfferScheduleItem[];
  onItemCta?: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {["Группа", "Дни", "Время", "Стоимость", ""].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 last:w-px"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 text-[14px] font-semibold text-gray-900">
                  {item.groupName || item.title || "—"}
                </td>
                <td className="px-6 py-4 text-[14px] text-gray-500">{item.days || "—"}</td>
                <td className="px-6 py-4 text-[14px] text-gray-500">{item.time || "—"}</td>
                <td className="px-6 py-4 text-[15px] font-bold text-gray-900">
                  {item.price || "Уточняйте"}
                </td>
                <td className="px-6 py-4 text-right">
                  {item.ctaEnabled !== false && (
                    <Button
                      size="sm"
                      className="h-9 rounded-full bg-[#EF8759] px-4 text-[13px] font-bold text-white hover:bg-[#e07848]"
                      onClick={() => onItemCta?.(item.id)}
                    >
                      {item.ctaLabel || "Записаться"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="sm:hidden divide-y divide-gray-50">
        {items.map((item) => (
          <div key={item.id} className="p-5 space-y-3">
            <p className="text-[15px] font-bold text-gray-900">
              {item.groupName || item.title || "Группа"}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-gray-500">
              {item.days && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {item.days}
                </span>
              )}
              {item.time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {item.time}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-bold text-gray-900">
                {item.price || "Уточняйте"}
              </span>
              {item.ctaEnabled !== false && (
                <Button
                  size="sm"
                  className="h-9 rounded-full bg-[#EF8759] px-4 text-[13px] font-bold text-white hover:bg-[#e07848]"
                  onClick={() => onItemCta?.(item.id)}
                >
                  {item.ctaLabel || "Записаться"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
