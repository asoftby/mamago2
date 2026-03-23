import type { Intent } from "@/lib/intent";
import type { SecondaryFilterGroup } from "@/lib/discovery/filterConfigByIntent";
import { filterConfigByIntent } from "@/lib/discovery/filterConfigByIntent";

export const SECONDARY_FILTERS_URL_KEY = "sec";

/** Значения secondary по intent: groupId → value */
export type SecondaryValues = Record<string, string | string[] | boolean>;

/** Все intent в одном query-параметре, чтобы не терять при смене вкладки */
export type SecondaryByIntentState = Partial<Record<Intent, SecondaryValues>>;

export function parseSecondaryFromSearchParams(
  searchParams: URLSearchParams,
): SecondaryByIntentState {
  const raw = searchParams.get(SECONDARY_FILTERS_URL_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SecondaryByIntentState;
  } catch {
    return {};
  }
}

export function getSecondaryForIntent(
  all: SecondaryByIntentState,
  intent: Intent,
): SecondaryValues {
  return all[intent] ?? {};
}

export function setSecondaryForIntent(
  all: SecondaryByIntentState,
  intent: Intent,
  next: SecondaryValues,
): SecondaryByIntentState {
  const cleaned = { ...all };
  const keys = Object.keys(next).filter((k) => {
    const v = next[k];
    if (v === false || v === "" || v === undefined) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  const slim: SecondaryValues = {};
  for (const k of keys) {
    slim[k] = next[k]!;
  }
  if (Object.keys(slim).length === 0) {
    delete cleaned[intent];
  } else {
    cleaned[intent] = slim;
  }
  return cleaned;
}

function optionLabel(
  group: SecondaryFilterGroup,
  value: string,
): string | null {
  if (group.kind === "boolean") return null;
  return group.options.find((o) => o.id === value)?.label ?? value;
}

function optionLabelsMulti(
  group: SecondaryFilterGroup,
  values: string[],
): string[] {
  if (group.kind === "boolean") return [];
  return values
    .map((id) => group.options.find((o) => o.id === id)?.label ?? id)
    .filter(Boolean);
}

/** Человекочитаемые подписи для chips (по текущему intent) */
export function secondaryLabelsForChips(
  intent: Intent,
  values: SecondaryValues,
): string[] {
  const groups = filterConfigByIntent[intent];
  const out: string[] = [];

  for (const group of groups) {
    const v = values[group.id];
    if (v === undefined || v === false || v === "") continue;

    if (group.kind === "boolean") {
      if (v === true) out.push(group.trueLabel);
      continue;
    }

    if (group.kind === "single" && typeof v === "string") {
      const lbl = optionLabel(group, v);
      if (lbl) out.push(lbl);
      continue;
    }

    if (group.kind === "multi" && Array.isArray(v) && v.length > 0) {
      out.push(...optionLabelsMulti(group, v));
    }
  }

  return out;
}

/** Количество активных secondary-групп (для бейджа) */
export function countSecondaryActive(
  intent: Intent,
  values: SecondaryValues,
): number {
  const groups = filterConfigByIntent[intent];
  let n = 0;
  for (const group of groups) {
    const v = values[group.id];
    if (v === undefined || v === false || v === "") continue;
    if (group.kind === "multi" && Array.isArray(v) && v.length === 0) continue;
    n += 1;
  }
  return n;
}
