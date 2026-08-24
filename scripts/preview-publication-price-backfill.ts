/**
 * Read-only price backfill preview. This script never issues create/update/delete/raw writes.
 */
import prisma from "../src/lib/prisma";
import {
  normalizePublicationPrice,
  parseSafeLegacyPriceText,
  type PriceNormalizationResult,
  type PublicationPriceMode,
} from "../src/domain/pricing/normalizedPrice";
import { getCampSessionPriceValues } from "../src/lib/offers/campPricing";

type EntityName = "Activity" | "Offer" | "Place";
type Counts = Record<PublicationPriceMode, number> & { total: number; conflicts: number; changes: number };

function emptyCounts(): Counts {
  return { total: 0, FREE: 0, EXACT: 0, FROM: 0, RANGE: 0, UNKNOWN: 0, conflicts: 0, changes: 0 };
}

function activityProjection(row: {
  priceFrom: number | null; priceTo: number | null; priceText: string | null;
  priceItems: unknown; scheduleJson: unknown;
}): PriceNormalizationResult {
  const schedule = row.scheduleJson && typeof row.scheduleJson === "object"
    ? row.scheduleJson as Record<string, unknown>
    : {};
  return normalizePublicationPrice({
    mode: schedule.pricingMode as "free" | "fixed" | "from" | undefined,
    min: row.priceFrom,
    max: row.priceTo,
    priceItems: row.priceItems,
    priceText: row.priceText,
  });
}

function offerProjection(row: {
  priceFrom: number | null; priceTo: number | null; priceText: string | null;
  priceItems: unknown; campSessions: unknown;
}): PriceNormalizationResult {
  const stored = normalizePublicationPrice({ priceItems: row.priceItems });
  if (stored.source === "STRUCTURED") return stored;
  const campValues = getCampSessionPriceValues(row.campSessions);
  if (campValues.length > 0) {
    return normalizePublicationPrice({ priceItems: campValues.map((price) => ({ price })) });
  }
  if (row.priceFrom != null && row.priceTo != null) {
    return normalizePublicationPrice({ min: row.priceFrom, max: row.priceTo });
  }
  const text = parseSafeLegacyPriceText(row.priceText);
  if (text.mode !== "UNKNOWN") {
    if (row.priceFrom == null || text.min === row.priceFrom) return text;
    return { ...text, mode: "UNKNOWN", min: null, max: null, conflict: "numeric-text-mismatch" };
  }
  // Historical Offer.priceFrom represented both exact and starting prices.
  return { ...text, conflict: row.priceFrom != null ? "ambiguous-offer-priceFrom" : null };
}

function summarize<T extends { id: string; priceFrom: number | null; priceTo: number | null }>(
  entity: EntityName,
  rows: T[],
  project: (row: T) => PriceNormalizationResult,
) {
  const counts = emptyCounts();
  const manualReview: Array<{ id: string; reason: string }> = [];
  for (const row of rows) {
    const next = project(row);
    counts.total += 1;
    counts[next.mode] += 1;
    if (next.conflict) counts.conflicts += 1;
    if (next.mode !== "UNKNOWN" || row.priceFrom !== next.min || row.priceTo !== next.max) counts.changes += 1;
    if (next.mode === "UNKNOWN" || next.conflict) manualReview.push({ id: row.id, reason: next.conflict ?? "unknown" });
  }
  return { entity, ...counts, manualReview };
}

async function main() {
  const [activities, offers, places] = await Promise.all([
    prisma.activity.findMany({ select: { id: true, priceFrom: true, priceTo: true, priceText: true, priceItems: true, scheduleJson: true } }),
    prisma.offer.findMany({ select: { id: true, priceFrom: true, priceText: true, campSessions: true } }),
    prisma.place.findMany({ select: { id: true, priceItems: true } }),
  ]);
  const report = [
    summarize("Activity", activities, activityProjection),
    summarize("Offer", offers.map((row) => ({ ...row, priceTo: null, priceItems: null })), offerProjection),
    summarize("Place", places.map((row) => ({ ...row, priceFrom: null, priceTo: null })), (row) => normalizePublicationPrice({ priceItems: row.priceItems })),
  ];
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), readOnly: true, report }, null, 2));
}

main().finally(() => prisma.$disconnect());
