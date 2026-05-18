"use client";

import type { OfferMetaItem } from "@/lib/offer/offerPageTypes";

interface OfferMetaGridProps {
  items: OfferMetaItem[];
}

/**
 * Facts Bar — editorial style.
 *
 * Линейная горизонтальная полоса с пронумерованными колонками (01, 02…).
 * Никаких иконочных кружков — только лейбл капс + крупное значение.
 * Mobile: 2 колонки, узкий — 1 колонка с горизонтальными разделителями.
 */
export function OfferMetaGrid({ items }: OfferMetaGridProps) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Ключевые параметры"
      className="border-y border-gray-100"
    >
      {/* Desktop / tablet: 1 ряд, до 5 колонок */}
      <div
        className="hidden sm:grid divide-x divide-gray-100"
        style={{
          gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, minmax(0, 1fr))`,
        }}
      >
        {items.slice(0, 5).map((item, i) => (
          <FactCell key={item.id} item={item} index={i} />
        ))}
      </div>

      {/* Mobile: 2 колонки */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 sm:hidden">
        {items.map((item, i) => (
          <FactCell key={item.id} item={item} index={i} mobile />
        ))}
      </div>
    </section>
  );
}

function FactCell({
  item,
  index,
  mobile = false,
}: {
  item: OfferMetaItem;
  index: number;
  mobile?: boolean;
}) {
  return (
    <div
      className={
        mobile
          ? "flex flex-col gap-1.5 px-4 py-4 [&:nth-child(n+3)]:border-t [&:nth-child(n+3)]:border-gray-100"
          : "flex flex-col gap-1.5 px-6 py-6"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 truncate">
          {item.label}
        </span>
        <span className="font-mono text-[10px] text-gray-300">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <p className="text-[18px] font-semibold tracking-[-0.01em] text-gray-900 leading-tight truncate">
        {item.value}
      </p>
    </div>
  );
}
