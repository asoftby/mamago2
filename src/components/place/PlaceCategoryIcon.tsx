"use client";

import {
  Coffee, Dumbbell, Flower2, Footprints, Gamepad2, GraduationCap,
  Landmark, MapPin, Palette, PartyPopper, Puzzle, ShoppingBag,
  Theater, Trees, Utensils, Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared visual fallback for places without a saved logo.
 * Match normalized category labels, never place titles or user-entered descriptions.
 */
const CATEGORIES = [
  { terms: ["парк", "лес", "сквер", "природ"], icon: Trees, bg: "#E9F4E9", fg: "#43865A" },
  { terms: ["сад", "ботан"], icon: Flower2, bg: "#EDF5E4", fg: "#688A3D" },
  { terms: ["прогул", "экскурс"], icon: Footprints, bg: "#E7F3F0", fg: "#398C81" },
  { terms: ["вод", "пляж", "бассейн", "аква"], icon: Waves, bg: "#E7F2FC", fg: "#4488B5" },
  { terms: ["игров", "развлекательн", "аттракцион"], icon: Gamepad2, bg: "#F1EAFE", fg: "#8860BE" },
  { terms: ["детск", "семейн", "развивающ"], icon: Puzzle, bg: "#FFF0DF", fg: "#C08345" },
  { terms: ["творч", "мастерск", "худож"], icon: Palette, bg: "#FBE9F0", fg: "#BA6387" },
  { terms: ["образова", "обучен", "школ", "студи"], icon: GraduationCap, bg: "#E8EEFA", fg: "#5F77B8" },
  { terms: ["музей", "галере", "истори"], icon: Landmark, bg: "#EFECE8", fg: "#91755A" },
  { terms: ["театр", "спектакл", "сцена"], icon: Theater, bg: "#F7E8EB", fg: "#AF677B" },
  { terms: ["кафе", "кофейн"], icon: Coffee, bg: "#F6EDE2", fg: "#A0784F" },
  { terms: ["ресторан", "еда", "пицц", "столов"], icon: Utensils, bg: "#FFF1E8", fg: "#BA815C" },
  { terms: ["спорт", "фитнес", "трениров", "стадион"], icon: Dumbbell, bg: "#E7F2F8", fg: "#438BAE" },
  { terms: ["праздник", "день рождения", "банкет"], icon: PartyPopper, bg: "#FBECF7", fg: "#AD65A4" },
  { terms: ["магазин", "торгов", "рынок"], icon: ShoppingBag, bg: "#EDF1F5", fg: "#6A8196" },
] as const;

export function PlaceCategoryIcon({
  category,
  className,
}: {
  category?: string | null;
  className?: string;
}) {
  const normalized = category?.toLocaleLowerCase("ru-RU").trim() ?? "";
  const match = CATEGORIES.find(({ terms }) => terms.some((term) => normalized.includes(term)));
  const Icon = match?.icon ?? MapPin;
  return (
    <span
      className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", className)}
      style={{ backgroundColor: match?.bg ?? "#EEF0F3", color: match?.fg ?? "#77818D" }}
      role="img"
      aria-label={category ? `Место: ${category}` : "Место"}
    >
      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}
