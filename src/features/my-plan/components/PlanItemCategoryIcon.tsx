"use client";

import type { ComponentType } from "react";
import {
  Dumbbell,
  GraduationCap,
  House,
  Palette,
  PartyPopper,
  Plane,
  ShoppingBag,
  StickyNote,
  Stethoscope,
  type LucideProps,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PLAN_ITEM_CATEGORY_KEYS,
  PLAN_ITEM_CATEGORY_LABELS,
  type PlanItemCategoryKey,
} from "../lib/planItemCategory";

const CATEGORY_ICONS: Record<PlanItemCategoryKey, ComponentType<LucideProps>> = {
  health: Stethoscope,
  sport: Dumbbell,
  school: GraduationCap,
  clubs: Palette,
  shopping: ShoppingBag,
  home: House,
  party: PartyPopper,
  trip: Plane,
  note: StickyNote,
};

/**
 * Плитка 40×40 / radius 10 для добавленных вручную пунктов.
 * Фон и цвет одинаковые для всех категорий (тёплый нейтральный тон) — меняется только иконка,
 * чтобы цветные постеры событий mamaGo выделялись.
 */
export function PlanItemCategoryTile({
  category,
  className,
}: {
  category: PlanItemCategoryKey;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-border text-text-muted",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

/** Плитка-кнопка: тап открывает выбор категории (если угадано неверно). */
export function PlanItemCategoryPicker({
  value,
  onChange,
  className,
  stopPropagation = false,
}: {
  value: PlanItemCategoryKey;
  onChange: (next: PlanItemCategoryKey) => void;
  className?: string;
  /** Внутри кликабельной карточки: не пускаем клик наверх. */
  stopPropagation?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Значок: ${PLAN_ITEM_CATEGORY_LABELS[value]}. Изменить`}
          onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
          className={cn(
            "shrink-0 rounded-[10px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            className,
          )}
        >
          <PlanItemCategoryTile category={value} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[236px] p-2"
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <div role="radiogroup" aria-label="Категория" className="grid grid-cols-3 gap-1">
          {PLAN_ITEM_CATEGORY_KEYS.map((key) => {
            const Icon = CATEGORY_ICONS[key];
            const selected = key === value;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(key)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] leading-tight outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring/60",
                  selected ? "bg-brand-soft text-brand-active" : "text-text-muted hover:bg-surface-hover",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                {PLAN_ITEM_CATEGORY_LABELS[key]}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
