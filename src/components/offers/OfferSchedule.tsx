"use client";

import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Flame } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { OfferScheduleItem, ShiftCtaContext } from "@/lib/offer/offerPageTypes";

interface OfferScheduleProps {
  type: "classes" | "shifts";
  items: OfferScheduleItem[];
  /** Для shifts — передаёт полный контекст смены */
  onShiftCta?: (ctx: ShiftCtaContext) => void;
  /** Для classes — передаёт id строки */
  onItemCta?: (itemId: string) => void;
}

export function OfferSchedule({
  type,
  items,
  onShiftCta,
  onItemCta,
}: OfferScheduleProps) {
  /** Помечаем «hot»-смену — первую открытую с минимальным процентом заполнения
   *  (от 1 до 70% — самые свежие, ещё есть места и есть скидка-стимул). */
  const hotShiftId = useMemo(() => {
    if (type !== "shifts") return null;
    const candidates = items.filter((s) => {
      if (s.capacity === undefined || s.spotsLeft === undefined) return false;
      if (s.spotsLeft === 0) return false;
      const filled = 1 - s.spotsLeft / s.capacity;
      return filled > 0 && filled < 0.7;
    });
    if (candidates.length === 0) return null;
    // выбираем с минимальной заполненностью
    return candidates.reduce((best, cur) => {
      const fb = 1 - (best.spotsLeft! / best.capacity!);
      const fc = 1 - (cur.spotsLeft! / cur.capacity!);
      return fc < fb ? cur : best;
    }).id;
  }, [type, items]);

  return (
    <section id="schedule" className="space-y-7 scroll-mt-24">
      {/* Editorial section header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3.5 mb-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-400">
              {type === "shifts" ? "04 — Смены и стоимость" : "04 — Расписание и стоимость"}
            </span>
            <span className="flex-1 h-px bg-gray-100 max-w-[180px]" />
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[36px] lg:text-[44px] font-normal tracking-[-0.02em] leading-[0.95] text-gray-900">
            Выбери своё{" "}
            <span className="italic text-[#C2522A]">лето</span>.
          </h2>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptySchedule onCta={() => onItemCta?.("empty")} />
      ) : type === "shifts" ? (
        <ShiftsList
          items={items}
          onShiftCta={onShiftCta}
          hotShiftId={hotShiftId}
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
  hotShiftId,
}: {
  items: OfferScheduleItem[];
  onShiftCta?: (ctx: ShiftCtaContext) => void;
  hotShiftId: string | null;
}) {
  return (
    <div className="space-y-3.5">
      {items.map((item) => (
        <ShiftCard
          key={item.id}
          item={item}
          onShiftCta={onShiftCta}
          isHot={item.id === hotShiftId}
        />
      ))}
    </div>
  );
}

function ShiftCard({
  item,
  onShiftCta,
  isHot,
}: {
  item: OfferScheduleItem;
  onShiftCta?: (ctx: ShiftCtaContext) => void;
  isHot?: boolean;
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

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow hover:shadow-md",
        isHot
          ? "border-[#EF8759]/25 bg-gradient-to-b from-[#FFF7F3] to-white"
          : "border-gray-100",
      )}
    >
      {/* Hot badge */}
      {isHot && (
        <span className="absolute right-5 top-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-[#C2522A]">
          <Flame className="h-3 w-3 fill-current" />
          hot
        </span>
      )}

      {/* ─── Desktop ─── */}
      <div className="hidden sm:grid grid-cols-[minmax(220px,1fr)_auto_auto] items-center gap-7 px-7 py-6">
        {/* Col 1 — info */}
        <div className="min-w-0">
          {item.ageRange && (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1.5">
              {item.ageRange}
            </p>
          )}
          {item.title && (
            <h3 className="text-[20px] font-bold tracking-[-0.01em] text-gray-900 truncate">
              {item.title}
            </h3>
          )}
          {dateLabel && (
            <p className="mt-1 font-mono text-[12px] text-gray-500">{dateLabel}</p>
          )}
        </div>

        {/* Col 2 — price */}
        {item.price && (
          <div className="text-right shrink-0">
            <p className="font-[family-name:var(--font-display)] text-[40px] leading-[1] tracking-[-0.02em] text-gray-900">
              {item.price}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 mt-1">
              за смену
            </p>
            {item.duration && (
              <p className="mt-2 text-[12px] text-gray-500">
                <Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                {item.duration}
              </p>
            )}
          </div>
        )}

        {/* Col 3 — actions */}
        <div className="flex items-center shrink-0">
          {item.ctaEnabled !== false && !isFull ? (
            <Button
              onClick={() => onShiftCta?.(ctx)}
              className="h-12 rounded-full bg-[#EF8759] px-6 text-[14px] font-bold text-white shadow-sm shadow-[#EF8759]/25 hover:bg-[#e07848] transition-all"
            >
              {item.ctaLabel ?? "Записаться"}
            </Button>
          ) : (
            <Button
              disabled
              variant="outline"
              className="h-12 rounded-full border-gray-200 px-6 text-[13px] font-semibold text-gray-400"
            >
              В лист ожидания
            </Button>
          )}

        </div>
      </div>

      {/* ─── Mobile ─── */}
      <div className="sm:hidden p-5 space-y-4">
        {/* Title + ages */}
        <div className="space-y-1">
          {item.ageRange && (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">
              {item.ageRange}
            </p>
          )}
          {item.title && (
            <h3 className="text-[17px] font-bold text-gray-900">{item.title}</h3>
          )}
          {dateLabel && (
            <p className="font-mono text-[12px] text-gray-500">{dateLabel}</p>
          )}
        </div>

        {/* Price */}
        {item.price && (
          <div className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-[32px] leading-[1] text-gray-900">
              {item.price}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">
              за смену
            </span>
          </div>
        )}

        {item.duration && (
          <p className="text-[13px] text-gray-500">
            <Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            {item.duration}
          </p>
        )}

        {/* Actions */}
        <div className="flex">
          {item.ctaEnabled !== false && !isFull ? (
            <Button
              onClick={() => onShiftCta?.(ctx)}
              className="h-11 flex-1 rounded-full bg-[#EF8759] text-[14px] font-bold text-white hover:bg-[#e07848]"
            >
              {item.ctaLabel ?? "Записаться"}
            </Button>
          ) : (
            <Button
              disabled
              variant="outline"
              className="h-11 flex-1 rounded-full border-gray-200 text-[13px] font-semibold text-gray-400"
            >
              В лист ожидания
            </Button>
          )}
        </div>
      </div>
    </article>
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
