import { formatPrice, formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import type { ActivityCardItem } from "../types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function formatAgeLabel(record: Record<string, unknown>): string | null {
  const direct = getNestedString(record, ["ageLabel", "ageHintBadge"]);
  if (direct) return direct;

  const ageMinMonths = asNumber(record.ageMinMonths);
  if (ageMinMonths == null) return null;

  const years = Math.max(0, Math.floor(ageMinMonths / 12));
  return `${years}+`;
}

function formatPriceLabel(record: Record<string, unknown>): string | null {
  const direct = getNestedString(record, ["priceLabel", "priceText"]);
  if (direct) return normalizeUiCurrencyText(direct);

  const priceFrom = asNumber(record.priceFrom);
  if (priceFrom == null) return null;
  if (priceFrom === 0) return "Бесплатно";
  const priceTo = asNumber(record.priceTo);
  const useFrom = priceTo == null || priceTo !== priceFrom;
  return useFrom ? formatPriceFrom(priceFrom, { hideZero: true }) : formatPrice(priceFrom, { hideZero: true });
}

function formatDateLabel(record: Record<string, unknown>): string | null {
  const direct = getNestedString(record, ["dateLabel", "dateText", "scheduleLabel", "workingHours"]);
  if (direct) return direct;

  const startRaw = getNestedString(record, ["dateStart", "startsAt"]);
  if (!startRaw) return null;

  const endRaw = getNestedString(record, ["dateEnd"]);
  const start = new Date(startRaw);
  if (!Number.isFinite(start.getTime())) return null;

  const startLabel = start.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });

  if (!endRaw) return startLabel;

  const end = new Date(endRaw);
  if (!Number.isFinite(end.getTime())) return startLabel;

  const endLabel = end.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });

  return `${startLabel} - ${endLabel}`;
}

function resolvePastState(record: Record<string, unknown>): boolean {
  if (typeof record.isPast === "boolean") return record.isPast;

  const rawDate = getNestedString(record, ["dateEnd", "dateStart", "startsAt"]);
  if (!rawDate) return false;

  const parsed = new Date(rawDate);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() < Date.now() : false;
}

export function mapEventToActivityCardItem(input: unknown): ActivityCardItem {
  const record = asRecord(input);
  const venue = asRecord(record.venue);
  const place = asRecord(record.place);

  const id = getNestedString(record, ["id"]) ?? "unknown-event";
  const title = getNestedString(record, ["title", "name"]) ?? "Событие";
  const href =
    getNestedString(record, ["href", "publicHref", "url"]) ?? "#";
  const imageUrl =
    getNestedString(record, ["imageUrl", "coverImageUrl", "coverImage", "image"]) ?? null;

  return {
    id,
    type: "event",
    title,
    href,
    imageUrl,
    badgeLabel: getNestedString(record, ["badgeLabel", "badge", "formatLabel"]),
    placeTitle:
      getNestedString(record, ["placeTitle"]) ??
      getNestedString(venue, ["name"]) ??
      getNestedString(place, ["title", "name"]),
    addressLabel:
      getNestedString(record, ["addressLabel", "locationLabel"]) ??
      getNestedString(venue, ["address"]) ??
      getNestedString(place, ["address", "cityAddress"]),
    priceLabel: formatPriceLabel(record),
    ageLabel: formatAgeLabel(record),
    categoryLabel:
      getNestedString(record, ["categoryLabel"]) ??
      getNestedString(asRecord(record.eventCategory), ["nameRu", "name"]),
    isSaved: asBoolean(record.isSaved),
    isPlanned: asBoolean(record.isPlanned),
    isPast: resolvePastState(record),
    dateLabel: formatDateLabel(record),
    // TODO: Уточнить business-приоритет statusLabel относительно past/saved/planned UI статусов.
    statusLabel: getNestedString(record, ["statusLabel"]),
  };
}
