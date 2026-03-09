import { AGE_OPTIONS } from "@/lib/config/ages";

export type AgeRange = { minMonths: number; maxMonths: number | null };

export type AgeDef = {
  value: string;
  label: string;
  group: "👶 Малыши" | "🧒 Дети" | "🧑 Подростки" | "👤 Взрослые";
  order: number;
  minMonths: number;
  maxMonths: number | null;
};

/**
 * Age definitions with grouping for UI display
 * Built from canonical AGE_OPTIONS
 */
export const AGE_DEFS: AgeDef[] = [
  // 👶 Малыши
  { value: "0-1", label: "0–1 год", group: "👶 Малыши", order: 10, minMonths: 0, maxMonths: 12 },
  { value: "1-3", label: "1–3 года", group: "👶 Малыши", order: 20, minMonths: 12, maxMonths: 36 },
  // 🧒 Дети
  { value: "3-5", label: "3–5 лет", group: "🧒 Дети", order: 30, minMonths: 36, maxMonths: 60 },
  { value: "5-7", label: "5–7 лет", group: "🧒 Дети", order: 40, minMonths: 60, maxMonths: 84 },
  { value: "7-9", label: "7–9 лет", group: "🧒 Дети", order: 50, minMonths: 84, maxMonths: 108 },
  { value: "9-12", label: "9–12 лет", group: "🧒 Дети", order: 60, minMonths: 108, maxMonths: 144 },
  // 🧑 Подростки
  { value: "12-14", label: "12–14 лет", group: "🧑 Подростки", order: 70, minMonths: 144, maxMonths: 168 },
  { value: "14-16", label: "14–16 лет", group: "🧑 Подростки", order: 80, minMonths: 168, maxMonths: 192 },
  { value: "16-18", label: "16–18 лет", group: "🧑 Подростки", order: 90, minMonths: 192, maxMonths: 216 },
  // 👤 Взрослые
  { value: "18+", label: "18+", group: "👤 Взрослые", order: 100, minMonths: 216, maxMonths: null },
];

export function selectedAgeValuesToRanges(
  selected: string[],
  allOptions: { value: string; minMonths: number; maxMonths: number | null }[] = AGE_DEFS
): AgeRange[] {
  const set = new Set(selected);
  const ranges: AgeRange[] = [];
  for (const opt of allOptions) {
    if (set.has(opt.value)) {
      ranges.push({ minMonths: opt.minMonths, maxMonths: opt.maxMonths });
    }
  }
  return ranges;
}
