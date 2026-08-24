/** Strictly read-only historical pricing recovery audit. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import prisma from "../src/lib/prisma";
import {
  normalizePublicationPrice,
  parseSafeLegacyPriceText,
  type NormalizedPriceRange,
  type PriceNormalizationResult,
  type PublicationPriceMode,
} from "../src/domain/pricing/normalizedPrice";
import { getCampSessionPriceValues } from "../src/lib/offers/campPricing";

type EntityName = "Activity" | "Offer" | "Place";
type Classification = "AUTO_SAFE" | "RECOVERABLE" | "MANUAL_REVIEW" | "NONE";
type Evidence = { source: string; path: string; value: unknown; interpretation?: NormalizedPriceRange };
type AuditRow = { entity: EntityName; id: string; classification: Classification; proposed: NormalizedPriceRange; reason: string; evidence: Evidence[] };
const PRICE_KEY = /price|pricing|cost|average.?check|тариф|цен/i;

function snapshotRootArg(): string | null {
  const index = process.argv.indexOf("--snapshot-root");
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

export function parseTariffCurrencyAmounts(value: string): NormalizedPriceRange | null {
  const text = value.replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|ndash|mdash);/gi, " ").replace(/\s+/g, " ").trim();
  if (/по запросу|уточняйте|зависит|стоимость включает|ранн\w* бронир|скидк|старая цена/i.test(text) || /<del\b/i.test(value)) return null;
  const values = [...text.matchAll(/((?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:BYN|Br|Б|руб(?:\.|ля|лей)?|р\.?)(?=$|[\s.,;:!?)/<])/giu)]
    .map((match) => Number(match[1].replace(/[\s\u00a0]/g, "").replace(",", ".")))
    .filter((amount) => Number.isFinite(amount) && amount >= 0);
  if (/(?:^|[^а-яё])бесплатно(?:$|[^а-яё])/i.test(text)) values.push(0);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { mode: min === 0 && max === 0 ? "FREE" : min === max ? "EXACT" : "RANGE", min, max, currency: "BYN" };
}

function compact(value: unknown): unknown {
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  const json = JSON.stringify(value);
  return json.length > 500 ? `${json.slice(0, 497)}...` : value;
}

function explicitProjection(value: unknown): PriceNormalizationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!["priceFrom", "priceTo", "priceMin", "priceMax", "priceItems", "pricingMode", "priceMode"].some((key) => key in record)) return null;
  return normalizePublicationPrice({
    mode: (record.priceMode ?? record.pricingMode) as PublicationPriceMode | undefined,
    min: record.priceFrom ?? record.priceMin,
    max: record.priceTo ?? record.priceMax,
    priceItems: record.priceItems,
    priceText: record.priceText,
  });
}

function collectEvidence(value: unknown, source: string, path = "$", inheritedRelevant = false): Evidence[] {
  if (value == null) return [];
  if (typeof value === "string") {
    if (!inheritedRelevant) return [];
    const parsed = parseSafeLegacyPriceText(value);
    const tariffRange = parsed.mode === "UNKNOWN" ? parseTariffCurrencyAmounts(value) : null;
    return [{ source, path, value: compact(value), ...(parsed.mode !== "UNKNOWN" ? { interpretation: parsed } : tariffRange ? { interpretation: tariffRange } : {}) }];
  }
  if (typeof value !== "object") return inheritedRelevant ? [{ source, path, value }] : [];
  const direct = explicitProjection(value);
  const result: Evidence[] = direct && direct.mode !== "UNKNOWN"
    ? [{ source, path, value: compact(value), interpretation: direct }]
    : [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => result.push(...collectEvidence(item, source, `${path}[${index}]`, inheritedRelevant)));
  } else {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result.push(...collectEvidence(child, source, `${path}.${key}`, inheritedRelevant || PRICE_KEY.test(key)));
    }
  }
  return result.slice(0, 40);
}

function uniqueInterpretations(evidence: Evidence[]): NormalizedPriceRange[] {
  const values = new Map<string, NormalizedPriceRange>();
  evidence.forEach((item) => {
    const value = item.interpretation;
    if (!value || value.mode === "UNKNOWN" || value.mode === "NONE") return;
    values.set(`${value.mode}:${value.min}:${value.max}:${value.currency}`, value);
  });
  return [...values.values()];
}

function classify(entity: EntityName, id: string, current: PriceNormalizationResult, evidence: Evidence[]): AuditRow {
  if (current.mode !== "UNKNOWN" && current.conflict == null) {
    return { entity, id, classification: "AUTO_SAFE", proposed: current, reason: `authoritative-${current.source.toLowerCase()}`, evidence };
  }
  const candidates = uniqueInterpretations(evidence);
  if (candidates.length === 1) {
    return { entity, id, classification: "RECOVERABLE", proposed: candidates[0], reason: "single-unambiguous-historical-interpretation", evidence };
  }
  if (entity === "Place" && evidence.length === 1 && evidence[0]?.source === "current.place") {
    return { entity, id, classification: "NONE", proposed: normalizePublicationPrice({ mode: "NONE" }), reason: "place-has-no-own-price-evidence", evidence };
  }
  return { entity, id, classification: "MANUAL_REVIEW", proposed: normalizePublicationPrice({ mode: "UNKNOWN" }), reason: candidates.length > 1 ? "conflicting-historical-interpretations" : current.conflict ?? "no-provable-price-intent", evidence };
}

function currentEvidence(source: string, value: unknown, projection: PriceNormalizationResult): Evidence {
  return { source, path: "$", value: compact(value), ...(projection.mode !== "UNKNOWN" ? { interpretation: projection } : {}) };
}

function activityProjection(row: { priceFrom: number | null; priceTo: number | null; priceText: string | null; priceItems: unknown; scheduleJson: unknown }) {
  const schedule = row.scheduleJson && typeof row.scheduleJson === "object" ? row.scheduleJson as Record<string, unknown> : {};
  return normalizePublicationPrice({ mode: schedule.pricingMode as "free" | "fixed" | "from" | undefined, min: row.priceFrom, max: row.priceTo, priceItems: row.priceItems, priceText: row.priceText });
}

function offerProjection(row: { priceFrom: number | null; priceText: string | null; campSessions: unknown }) {
  const campValues = getCampSessionPriceValues(row.campSessions);
  if (campValues.length > 0) return normalizePublicationPrice({ priceItems: campValues.map((price) => ({ price })) });
  const text = parseSafeLegacyPriceText(row.priceText);
  if (text.mode !== "UNKNOWN" && (row.priceFrom == null || text.min === row.priceFrom)) return text;
  return { ...text, conflict: row.priceFrom != null ? "ambiguous-offer-priceFrom" : null };
}

function summarize(rows: AuditRow[]) {
  const classifications: Record<Classification, number> = { AUTO_SAFE: 0, RECOVERABLE: 0, MANUAL_REVIEW: 0, NONE: 0 };
  const modes: Record<PublicationPriceMode, number> = { FREE: 0, EXACT: 0, FROM: 0, RANGE: 0, NONE: 0, UNKNOWN: 0 };
  rows.forEach((row) => { classifications[row.classification] += 1; modes[row.proposed.mode] += 1; });
  return { total: rows.length, classifications, proposedModes: modes };
}

async function main() {
  const [activities, offers, places, lineage, imported, adminAudits, placeRevisionCount] = await Promise.all([
    prisma.activity.findMany({ select: { id: true, priceFrom: true, priceTo: true, priceText: true, priceItems: true, scheduleJson: true } }),
    prisma.offer.findMany({ select: { id: true, priceFrom: true, priceText: true, campSessions: true } }),
    prisma.place.findMany({ select: { id: true, priceItems: true } }),
    prisma.migrationLineage.findMany({ where: { targetType: { in: ["ACTIVITY", "OFFER", "PLACE"] }, targetId: { not: null } }, select: { targetType: true, targetId: true, sourceRecordKey: true, record: { select: { rawPayload: true, normalizedPayload: true, planSummary: true, validationSummary: true } } } }),
    prisma.importedRecord.findMany({ where: { OR: [{ publishedActivityId: { not: null } }, { publishedPlaceId: { not: null } }] }, select: { publishedActivityId: true, publishedPlaceId: true, rawPayload: true, rawText: true, normalizedData: true, reviewDecision: true, applyResult: true } }),
    prisma.adminAuditLog.findMany({ where: { entityType: { in: ["Activity", "Offer", "Place", "ACTIVITY", "OFFER", "PLACE"] } }, select: { entityType: true, entityId: true, before: true, after: true, metadata: true, createdAt: true } }),
    prisma.placeRevision.count(),
  ]);

  const historical = new Map<string, Evidence[]>();
  const add = (key: string, items: Evidence[]) => historical.set(key, [...(historical.get(key) ?? []), ...items]);
  const targetKeyBySourceRecordKey = new Map(lineage.map((item) => [item.sourceRecordKey, item.targetId ? `${item.targetType}:${item.targetId}` : null]));
  lineage.forEach((item) => {
    if (!item.targetId || !item.record) return;
    const source = `migration:${item.sourceRecordKey}`;
    add(`${item.targetType}:${item.targetId}`, [
      ...collectEvidence(item.record.normalizedPayload, `${source}:normalized`),
      ...collectEvidence(item.record.rawPayload, `${source}:raw`),
      ...collectEvidence(item.record.planSummary, `${source}:plan`),
      ...collectEvidence(item.record.validationSummary, `${source}:validation`),
    ]);
  });
  imported.forEach((item, index) => {
    const key = item.publishedActivityId ? `ACTIVITY:${item.publishedActivityId}` : item.publishedPlaceId ? `PLACE:${item.publishedPlaceId}` : null;
    if (!key) return;
    add(key, [
      ...collectEvidence(item.normalizedData, `importedRecord:${index}:normalized`),
      ...collectEvidence(item.rawPayload, `importedRecord:${index}:raw`),
      ...collectEvidence(item.rawText, `importedRecord:${index}:text`, true),
      ...collectEvidence(item.reviewDecision, `importedRecord:${index}:review`),
      ...collectEvidence(item.applyResult, `importedRecord:${index}:apply`),
    ]);
  });
  adminAudits.forEach((item) => {
    const type = item.entityType.toUpperCase() === "EVENT" ? "ACTIVITY" : item.entityType.toUpperCase();
    add(`${type}:${item.entityId}`, [...collectEvidence(item.before, `adminAudit:${item.createdAt.toISOString()}:before`), ...collectEvidence(item.after, `adminAudit:${item.createdAt.toISOString()}:after`), ...collectEvidence(item.metadata, `adminAudit:${item.createdAt.toISOString()}:metadata`)]);
  });

  const snapshotRoot = snapshotRootArg();
  let snapshotRecordCount = 0;
  if (snapshotRoot) {
    for (const entity of ["events", "offers", "places"] as const) {
      const file = join(snapshotRoot, entity, "capture.json");
      if (!existsSync(file)) continue;
      const parsed = JSON.parse(readFileSync(file, "utf8")) as { records?: Array<{ sourceRecordKey?: unknown; rawPayload?: unknown }> };
      for (const record of parsed.records ?? []) {
        if (typeof record.sourceRecordKey !== "string") continue;
        const targetKey = targetKeyBySourceRecordKey.get(record.sourceRecordKey);
        if (!targetKey) continue;
        snapshotRecordCount += 1;
        add(targetKey, collectEvidence(record.rawPayload, `snapshot:${record.sourceRecordKey}:raw`));
      }
    }
  }

  const activityRows = activities.map((row) => { const current = activityProjection(row); return classify("Activity", row.id, current, [currentEvidence("current.activity", row, current), ...(historical.get(`ACTIVITY:${row.id}`) ?? [])]); });
  const offerRows = offers.map((row) => { const current = offerProjection(row); return classify("Offer", row.id, current, [currentEvidence("current.offer", row, current), ...(historical.get(`OFFER:${row.id}`) ?? [])]); });
  const placeRows = places.map((row) => { const current = normalizePublicationPrice({ priceItems: row.priceItems }); return classify("Place", row.id, current, [currentEvidence("current.place", row, current), ...(historical.get(`PLACE:${row.id}`) ?? [])]); });
  const rows = [...activityRows, ...offerRows, ...placeRows];
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(), readOnly: true,
    sourceAvailability: { migrationLineage: lineage.length, importedRecords: imported.length, adminAuditLogs: adminAudits.length, placeRevisions: placeRevisionCount, placeRevisionHasPriceFields: false, snapshotRoot, snapshotRecordsMatched: snapshotRecordCount },
    coverage: { Activity: summarize(activityRows), Offer: summarize(offerRows), Place: summarize(placeRows), all: summarize(rows) },
    rows,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().finally(() => prisma.$disconnect());
}
