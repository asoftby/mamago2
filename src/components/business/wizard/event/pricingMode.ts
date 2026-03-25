import type { EventFormData } from "./types";

export type PricingModeUi = Exclude<EventFormData["pricingMode"], never>;

function normalizeRawKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase().replace(/-/g, "_");
}

/**
 * Нормализует режим цены из scheduleJson / черновика / БД.
 * Удалённый режим «По запросу» (on-request / ON_REQUEST) → «Цена от», если есть цена, иначе «Бесплатно».
 */
export function normalizePricingMode(
  raw: unknown,
  ctx?: {
    priceText?: string | null;
    priceFrom?: number | null;
    priceTo?: number | null;
  },
): PricingModeUi {
  const pt = (ctx?.priceText ?? "").trim();
  const meaningfulText =
    pt.length > 0 &&
    !/^бесплатно$/i.test(pt) &&
    !/^free$/i.test(pt);
  const pf = ctx?.priceFrom != null ? Number(ctx.priceFrom) : null;
  const ptValid = meaningfulText;
  const hasNumeric = pf != null && !Number.isNaN(pf);

  const key = normalizeRawKey(raw);

  if (key === "free") return "free";
  if (key === "fixed") return "fixed";
  if (key === "from") return "from";
  if (key === "on_request" || key === "onrequest") {
    return ptValid || hasNumeric ? "from" : "free";
  }

  if (raw == null || raw === "") {
    if (!ptValid && !hasNumeric) return "free";
    const pto = ctx?.priceTo != null ? Number(ctx.priceTo) : null;
    if (
      pto != null &&
      pf != null &&
      !Number.isNaN(pto) &&
      !Number.isNaN(pf) &&
      pto === pf
    ) {
      return "fixed";
    }
    return "from";
  }

  return "free";
}
