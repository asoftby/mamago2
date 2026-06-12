export function parseCampSessionPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

export function getCampSessionPriceValues(campSessions: unknown): number[] {
  if (!Array.isArray(campSessions)) return [];

  return campSessions
    .map((session) => {
      if (!session || typeof session !== "object") return null;
      return parseCampSessionPrice(
        (session as { priceOverride?: unknown }).priceOverride,
      );
    })
    .filter((price): price is number => price != null);
}

export function getMinCampSessionPrice(campSessions: unknown): number | null {
  const prices = getCampSessionPriceValues(campSessions);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}
