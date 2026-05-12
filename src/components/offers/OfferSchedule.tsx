"use client";

import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Users, Heart, Check } from "lucide-react";
import { useState } from "react";
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

export function OfferSchedule({ type, items, onShiftCta, onItemCta }: OfferScheduleProps) {
  return (
    <section id="schedule" className="space-y-6 scroll-mt-24">
      <h2 className="text-[22px] font-bold text-gray-900 lg:text-[24px]">
        {type === "shifts" ? "Смены и стоимость" : "Расписание и стоимость"}
      </h2>

      {items.length === 0 ? (
        <EmptySchedule onCta={() => onItemCta?.("empty")} />
      ) : type === "shifts" ? (
        <ShiftsList items={items} onShiftCta={onShiftCta} />
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
        className="mt-5 h-11 rounded-2xl bg-[#EF8759] px-6 text-[14px] font-bold text-white hover:bg-[#e07848]"
        onClick={onCta}
      >
        Оставить заявку
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────
   Shifts List (CAMP) — вертикальный список
───────────────────────────────────────── */
function ShiftsList({
  items,
  onShiftCta,
}: {
  items: OfferScheduleItem[];
  onShiftCta?: (ctx: ShiftCtaContext) => void;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ShiftCard key={item.id} item={item} onShiftCta={onShiftCta} />
      ))}
    </div>
  );
}

function ShiftCard({
  item,
  onShiftCta,
}: {
  item: OfferScheduleItem;
  onShiftCta?: (ctx: ShiftCtaContext) => void;
}) {
  const [inPlan, setInPlan] = useState(false);

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

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* ── Desktop layout ── */}
      <div className="hidden sm:flex items-center gap-6 px-7 py-6">
        {/* Left: info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title + dates */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {item.title && (
              <h3 className="text-[16px] font-bold text-gray-900">{item.title}</h3>
            )}
            {dateLabel && (
              <span className="flex items-center gap-1 text-[14px] font-medium text-[#EF8759]">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {dateLabel}
              </span>
            )}
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {item.ageRange && (
              <MetaChip icon={<Users className="h-3.5 w-3.5" />} label={item.ageRange} />
            )}
            {item.duration && (
              <MetaChip icon={<Clock className="h-3.5 w-3.5" />} label={item.duration} />
            )}
            {item.spotsLeft !== undefined && item.capacity !== undefined && (
              <MetaChip
                icon={<Users className="h-3.5 w-3.5" />}
                label={`${item.spotsLeft} из ${item.capacity} мест`}
                highlight={item.spotsLeft <= 3}
              />
            )}
          </div>
        </div>

        {/* Right: price + actions */}
        <div className="flex shrink-0 items-center gap-4">
          {item.price && (
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Стоимость</p>
              <p className="text-[20px] font-bold text-gray-900 leading-tight">{item.price}</p>
            </div>
          )}

          {item.ctaEnabled !== false && (
            <Button
              onClick={() => onShiftCta?.(ctx)}
              className="h-11 rounded-2xl bg-[#EF8759] px-5 text-[14px] font-bold text-white hover:bg-[#e07848] transition-all shadow-sm"
            >
              {item.ctaLabel ?? "Записаться"}
            </Button>
          )}

          <button
            type="button"
            aria-label={inPlan ? "Убрать из плана" : "В план"}
            onClick={() => setInPlan((v) => !v)}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all",
              inPlan
                ? "border-[#EF8759] bg-[#FFF7F3] text-[#EF8759]"
                : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600",
            )}
          >
            {inPlan ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="sm:hidden p-5 space-y-4">
        {/* Title + dates */}
        <div className="space-y-1">
          {item.title && (
            <h3 className="text-[15px] font-bold text-gray-900">{item.title}</h3>
          )}
          {dateLabel && (
            <span className="flex items-center gap-1 text-[13px] font-medium text-[#EF8759]">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {dateLabel}
            </span>
          )}
        </div>

        {/* Meta chips */}
        {(item.ageRange || item.duration) && (
          <div className="flex flex-wrap gap-2">
            {item.ageRange && (
              <MetaChip icon={<Users className="h-3.5 w-3.5" />} label={item.ageRange} />
            )}
            {item.duration && (
              <MetaChip icon={<Clock className="h-3.5 w-3.5" />} label={item.duration} />
            )}
          </div>
        )}

        {/* Price */}
        {item.price && (
          <p className="text-[20px] font-bold text-gray-900">{item.price}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {item.ctaEnabled !== false && (
            <Button
              onClick={() => onShiftCta?.(ctx)}
              className="h-11 flex-1 rounded-2xl bg-[#EF8759] text-[14px] font-bold text-white hover:bg-[#e07848]"
            >
              {item.ctaLabel ?? "Записаться"}
            </Button>
          )}
          <button
            type="button"
            aria-label={inPlan ? "Убрать из плана" : "В план"}
            onClick={() => setInPlan((v) => !v)}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-2xl border px-4 text-[13px] font-bold transition-all",
              inPlan
                ? "border-[#EF8759] bg-[#FFF7F3] text-[#EF8759]"
                : "border-gray-200 text-gray-500 hover:border-gray-300",
            )}
          >
            {inPlan ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
            {inPlan ? "В плане" : "В план"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Classes Table (REGULAR)
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
                      className="h-9 rounded-xl bg-[#EF8759] px-4 text-[13px] font-bold text-white hover:bg-[#e07848]"
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
                  className="h-9 rounded-xl bg-[#EF8759] px-4 text-[13px] font-bold text-white hover:bg-[#e07848]"
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

/* ─────────────────────────────────────────
   Shared: Meta Chip
───────────────────────────────────────── */
function MetaChip({
  icon,
  label,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
        highlight
          ? "bg-red-50 text-red-600"
          : "bg-gray-100 text-gray-600",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
