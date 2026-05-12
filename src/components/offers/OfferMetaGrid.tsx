"use client";

import {
  Users,
  Clock,
  Calendar,
  MapPin,
  Award,
  Layout,
  Users2,
  Briefcase,
  Info,
  CalendarDays,
} from "lucide-react";
import type { OfferMetaItem } from "@/lib/offer/offerPageTypes";

interface OfferMetaGridProps {
  items: OfferMetaItem[];
}

function getIconForLabel(label: string) {
  const l = label.toLowerCase();
  if (l.includes("возраст")) return <Users className="h-[18px] w-[18px]" />;
  if (l.includes("формат")) return <Layout className="h-[18px] w-[18px]" />;
  if (l.includes("длительность")) return <Clock className="h-[18px] w-[18px]" />;
  if (l.includes("период")) return <CalendarDays className="h-[18px] w-[18px]" />;
  if (l.includes("уровень")) return <Award className="h-[18px] w-[18px]" />;
  if (l.includes("группа") || l.includes("места")) return <Users2 className="h-[18px] w-[18px]" />;
  if (l.includes("цена") || l.includes("стоимость")) return <Briefcase className="h-[18px] w-[18px]" />;
  if (l.includes("локация") || l.includes("адрес")) return <MapPin className="h-[18px] w-[18px]" />;
  if (l.includes("тип") || l.includes("вид")) return <Calendar className="h-[18px] w-[18px]" />;
  return <Info className="h-[18px] w-[18px]" />;
}

/**
 * Facts Bar — ключевые параметры предложения
 * Горизонтальная карточка с иконками в orange tinted circles
 * Desktop: 5 колонок в одной карточке
 * Mobile: 2 колонки или горизонтальный scroll
 */
export function OfferMetaGrid({ items }: OfferMetaGridProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm">
      {/* Desktop: single row */}
      <div className="hidden sm:flex divide-x divide-gray-100">
        {items.map((item) => (
          <FactItem key={item.id} item={item} className="flex-1 px-6 py-5" />
        ))}
      </div>

      {/* Mobile: 2-column grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:hidden">
        {items.map((item, idx) => (
          <FactItem
            key={item.id}
            item={item}
            className="px-4 py-4"
            // last item spans full width if odd count
            style={items.length % 2 !== 0 && idx === items.length - 1 ? { gridColumn: "1 / -1" } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function FactItem({
  item,
  className,
  style,
}: {
  item: OfferMetaItem;
  className?: string;
  style?: React.CSSProperties;
}) {
  const icon = getIconForLabel(item.label);

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`} style={style}>
      {/* Icon in orange circle */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF7F3] text-[#EF8759]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 truncate">
          {item.label}
        </p>
        <p className="text-[14px] font-bold text-gray-900 leading-tight truncate">
          {item.value}
        </p>
      </div>
    </div>
  );
}
