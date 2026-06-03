import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";

export type LegacyBudgetLevel = "FREE" | "LOW" | "MEDIUM" | "HIGH";

export type RouteStopPriceType =
  | "FREE"
  | "FIXED"
  | "RANGE"
  | "FROM"
  | "CUSTOM"
  | "UNKNOWN";

export type RouteBudgetStopLike = {
  priceType?: RouteStopPriceType | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceCurrency?: string | null;
  priceNote?: string | null;
};

export const LEGACY_BUDGET_LABELS: Record<LegacyBudgetLevel, string> = {
  FREE: "Бесплатно",
  LOW: "до 50 BYN",
  MEDIUM: "50–150 BYN",
  HIGH: "150+ BYN",
};

type RouteBudgetSummary = {
  label: string;
  note: string | null;
  legacyBudgetLevel: LegacyBudgetLevel;
  source: "computed" | "legacy" | "unknown";
  hasPreciseNumericValue: boolean;
  hasUncertainCosts: boolean;
};

function normalizeAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatPrice(min);
  return `${formatPrice(min)} – ${formatPrice(max)}`;
}

export function summarizeRouteBudget(
  stops: RouteBudgetStopLike[],
  fallbackBudgetLevel?: LegacyBudgetLevel | null,
): RouteBudgetSummary {
  let totalMin = 0;
  let totalMax = 0;
  let hasMaxlessPoint = false;
  let hasAnyStructuredPrice = false;
  let hasUncertainCosts = false;

  for (const stop of stops) {
    const priceType = stop.priceType ?? "UNKNOWN";
    const priceMin = normalizeAmount(stop.priceMin);
    const priceMax = normalizeAmount(stop.priceMax);

    switch (priceType) {
      case "FREE":
        hasAnyStructuredPrice = true;
        break;
      case "FIXED":
        if (priceMin != null) {
          hasAnyStructuredPrice = true;
          totalMin += priceMin;
          totalMax += priceMin;
        } else {
          hasUncertainCosts = true;
        }
        break;
      case "RANGE":
        if (priceMin != null && priceMax != null) {
          hasAnyStructuredPrice = true;
          totalMin += Math.min(priceMin, priceMax);
          totalMax += Math.max(priceMin, priceMax);
        } else {
          hasUncertainCosts = true;
        }
        break;
      case "FROM":
        if (priceMin != null) {
          hasAnyStructuredPrice = true;
          totalMin += priceMin;
          hasMaxlessPoint = true;
        } else {
          hasUncertainCosts = true;
        }
        break;
      case "CUSTOM":
      case "UNKNOWN":
        hasUncertainCosts = true;
        break;
    }
  }

  if (!hasAnyStructuredPrice) {
    if (fallbackBudgetLevel) {
      return {
        label: LEGACY_BUDGET_LABELS[fallbackBudgetLevel],
        note: "Пока используется старый бюджет маршрута без детализации по точкам.",
        legacyBudgetLevel: fallbackBudgetLevel,
        source: "legacy",
        hasPreciseNumericValue: false,
        hasUncertainCosts,
      };
    }

    return {
      label: "Стоимость не указана",
      note: null,
      legacyBudgetLevel: "LOW",
      source: "unknown",
      hasPreciseNumericValue: false,
      hasUncertainCosts: true,
    };
  }

  const hasPreciseNumericValue = !hasMaxlessPoint;
  const computedLegacyBudgetLevel: LegacyBudgetLevel =
    totalMin === 0 && totalMax === 0 && !hasUncertainCosts
      ? "FREE"
      : hasMaxlessPoint
        ? totalMin >= 150
          ? "HIGH"
          : totalMin >= 50
            ? "MEDIUM"
            : "LOW"
        : totalMax <= 50
          ? "LOW"
          : totalMin >= 150 || totalMax > 150
            ? "HIGH"
            : "MEDIUM";

  const baseLabel =
    totalMin === 0 && totalMax === 0 && !hasUncertainCosts
      ? "Бесплатно"
      : hasMaxlessPoint
        ? formatPriceFrom(totalMin)
        : formatPriceRange(totalMin, totalMax);

  return {
    label: baseLabel,
    note: hasUncertainCosts ? "Есть расходы без точной суммы." : null,
    legacyBudgetLevel: computedLegacyBudgetLevel,
    source: "computed",
    hasPreciseNumericValue,
    hasUncertainCosts,
  };
}
