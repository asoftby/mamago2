import { getAgeOption } from "@/lib/config/ages";
import type { BirthdayAgeGroup } from "../../types/birthday";

/** Если нет `selectedAgeLabel` (prefill без сигнала) — показываем согласованные грубые ведра */
const COARSE_AGE_FALLBACK_LABEL: Record<BirthdayAgeGroup, string> = {
  "0-3": "0–3 года",
  "3-5": "3–5 лет",
  "5-8": "6–10 лет",
  "8-12": "10+ лет",
};

/** Единый текст возраста для UI (чипы, sticky bar, summary) */
export function getDisplayedAgeLabel(input: {
  ageGroup: BirthdayAgeGroup | null;
  selectedAgeLabel: string | null;
}): string | null {
  if (!input.ageGroup) return null;
  const t = input.selectedAgeLabel?.trim();
  if (t) return t;
  return COARSE_AGE_FALLBACK_LABEL[input.ageGroup] ?? input.ageGroup;
}

/** Public DTO for age signal options (builder + API). */
export type PublicAgeSignalOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean;
  minAge: number;
  maxAge: number;
  /** Ranking weight (default 1); reserved for future taxonomy field */
  weight?: number;
};

// ─── Builder coarse buckets (filterBirthdayOffers AGE_RANGES) ────────────────

const BUILDER_BUCKETS: { group: BirthdayAgeGroup; min: number; max: number }[] = [
  { group: "0-3", min: 0, max: 3 },
  { group: "3-5", min: 3, max: 5 },
  { group: "5-8", min: 5, max: 8 },
  { group: "8-12", min: 8, max: 12 },
];

const KNOWN_VALUE_TO_GROUP: Record<string, BirthdayAgeGroup> = {
  "0-3": "0-3",
  "3-5": "3-5",
  "5-8": "5-8",
  "8-12": "8-12",
  "6-8": "5-8",
  "6-10": "5-8",
  "9-12": "8-12",
  "10+": "8-12",
  "10": "8-12",
};

function overlapYears(aMin: number, aMax: number, bMin: number, bMax: number): number {
  const lo = Math.max(aMin, bMin);
  const hi = Math.min(aMax, bMax);
  return Math.max(0, hi - lo + 1);
}

/**
 * Resolve numeric bounds for a signal `value` (and optional canonical age key).
 */
export function resolveAgeBoundsFromSignalValue(value: string): { minAge: number; maxAge: number } {
  const normalized = value.trim().toLowerCase().replace(/\s/g, "");
  const canonical = getAgeOption(normalized);
  if (canonical) {
    return { minAge: canonical.minAge, maxAge: canonical.maxAge };
  }
  const known = KNOWN_VALUE_TO_GROUP[normalized];
  if (known) {
    const b = BUILDER_BUCKETS.find((x) => x.group === known)!;
    return { minAge: b.min, maxAge: b.max };
  }
  const m = normalized.match(/^(\d+)-(\d+)$/);
  if (m) {
    return { minAge: Number(m[1]), maxAge: Number(m[2]) };
  }
  if (normalized.endsWith("+")) {
    const n = parseInt(normalized.replace("+", ""), 10);
    if (!Number.isNaN(n)) return { minAge: n, maxAge: 120 };
  }
  return { minAge: 0, maxAge: 12 };
}

/**
 * Map taxonomy age signal → builder `BirthdayAgeGroup` for filters / sticky bar.
 */
export function mapSignalToBuilderAgeGroup(opt: {
  value: string;
  minAge: number;
  maxAge: number;
}): BirthdayAgeGroup {
  const v = opt.value.trim().toLowerCase().replace(/\s/g, "");
  const direct = KNOWN_VALUE_TO_GROUP[v];
  if (direct) return direct;

  let best: BirthdayAgeGroup = "0-3";
  let bestScore = -1;
  for (const b of BUILDER_BUCKETS) {
    const s = overlapYears(opt.minAge, opt.maxAge, b.min, b.max);
    if (s > bestScore) {
      bestScore = s;
      best = b.group;
    }
  }
  if (bestScore <= 0) {
    const mid = (opt.minAge + opt.maxAge) / 2;
    if (mid < 3) return "0-3";
    if (mid < 5) return "3-5";
    if (mid < 8) return "5-8";
    return "8-12";
  }
  return best;
}

/** Fallback when taxonomy is empty (dev / misconfiguration). Synthetic ids. */
export const FALLBACK_AGE_SIGNAL_OPTIONS: PublicAgeSignalOption[] = [
  {
    id: "fallback-age-0-3",
    label: "0–3 года",
    value: "0-3",
    order: 1,
    active: true,
    minAge: 0,
    maxAge: 3,
    weight: 1,
  },
  {
    id: "fallback-age-3-5",
    label: "3–5 лет",
    value: "3-5",
    order: 2,
    active: true,
    minAge: 3,
    maxAge: 5,
    weight: 1,
  },
  {
    id: "fallback-age-5-8",
    label: "6–10 лет",
    value: "5-8",
    order: 3,
    active: true,
    minAge: 5,
    maxAge: 8,
    weight: 1,
  },
  {
    id: "fallback-age-8-12",
    label: "10+ лет",
    value: "8-12",
    order: 4,
    active: true,
    minAge: 8,
    maxAge: 12,
    weight: 1,
  },
];

/** Подписи для «ведёр» детского builder (value как в сиде taxonomy); иначе — label из каталога. */
export function chipLabelForAgeOption(opt: PublicAgeSignalOption): string {
  const v = opt.value.trim().toLowerCase().replace(/\s/g, "");
  if (v === "5-8") return "6–10 лет";
  if (v === "8-12") return "10+ лет";
  if (v === "0-3") return "0–3 года";
  if (v === "3-5") return "3–5 лет";
  return opt.label;
}

/**
 * Подобрать опцию age signal по полным годам (для маппинга из даты рождения ребёнка).
 */
export function pickAgeSignalOptionForYears(
  years: number,
  options: PublicAgeSignalOption[]
): PublicAgeSignalOption | null {
  if (!options.length) return null;
  const y = Math.max(0, Math.min(17, Math.floor(years)));
  const inRange = options.filter((o) => y >= o.minAge && y <= o.maxAge);
  if (inRange.length > 0) {
    return [...inRange].sort((a, b) => a.order - b.order)[0];
  }
  let best = options[0];
  let bestDist = Infinity;
  for (const o of options) {
    const mid = (o.minAge + o.maxAge) / 2;
    const dist = Math.abs(y - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = o;
    }
  }
  return best;
}

/** Детский конструктор ДР: не показываем взрослые диапазоны (18+, 18+ лет и т.п.) */
export function filterAgeOptionsForBirthdayBuilder(
  options: PublicAgeSignalOption[]
): PublicAgeSignalOption[] {
  return options.filter((o) => {
    const v = o.value.trim().toLowerCase().replace(/\s/g, "");
    if (v === "18+" || v === "18") return false;
    if (o.minAge >= 18) return false;
    return true;
  });
}
