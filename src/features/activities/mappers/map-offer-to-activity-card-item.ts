import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
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
  const direct = getNestedString(record, ["ageLabel", "ageRange"]);
  if (direct) return direct;

  const ageMinMonths = asNumber(record.ageMinMonths);
  if (ageMinMonths == null) return null;

  const years = Math.max(0, Math.floor(ageMinMonths / 12));
  return `${years}+`;
}

function formatPriceLabel(record: Record<string, unknown>): string | null {
  return formatPublicCardPrice({ priceMode: asString(record.priceMode) as never, priceFrom: asNumber(record.priceFrom), priceTo: asNumber(record.priceTo), currency: asString(record.currency) });
}

function formatDateLabel(record: Record<string, unknown>): string | null {
  const direct = getNestedString(record, ["dateLabel", "dateText", "scheduleLabel"]);
  if (direct) return direct;

  const startRaw = getNestedString(record, ["dateStart", "dateFrom"]);
  if (!startRaw) return null;

  const endRaw = getNestedString(record, ["dateEnd", "dateTo"]);
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

  const rawDate = getNestedString(record, ["dateEnd", "dateStart"]);
  if (!rawDate) return false;

  const parsed = new Date(rawDate);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() < Date.now() : false;
}

function resolveOfferCategoryLabel(record: Record<string, unknown>): string | null {
  const direct = getNestedString(record, ["categoryLabel", "serviceTypeLabel", "category"]);
  if (direct) return direct;

  if (getNestedString(record, ["campProgramType"])) return "Лагерь";

  const kind = getNestedString(record, ["kind"]);
  switch (kind) {
    case "CLASS":
      return "Занятие";
    case "SERVICE":
      return "Услуга";
    case "EVENT":
      return "Событие";
    case "PARTY":
      return "Праздник";
    case "VISIT":
      return "Посещение";
    default:
      return kind;
  }
}

export function mapOfferToActivityCardItem(input: unknown): ActivityCardItem {
  const record = asRecord(input);
  const place = asRecord(record.place);

  const id = getNestedString(record, ["id"]) ?? "unknown-offer";
  const title = getNestedString(record, ["title", "name"]) ?? "Предложение";
  const href =
    getNestedString(record, ["href", "publicHref", "url"]) ?? "#";
  const imageUrl =
    getNestedString(record, ["imageUrl", "coverImageUrl", "coverImage", "image"]) ?? null;

  return {
    id,
    type: "offer",
    title,
    href,
    imageUrl,
    badgeLabel: getNestedString(record, ["badgeLabel", "promoBadge", "badge"]),
    dateLabel: formatDateLabel(record),
    placeTitle:
      getNestedString(record, ["placeTitle"]) ??
      getNestedString(place, ["title", "name"]),
    addressLabel:
      getNestedString(record, ["addressLabel", "locationLabel"]) ??
      getNestedString(place, ["address", "cityAddress"]),
    priceLabel: formatPriceLabel(record),
    ageLabel: formatAgeLabel(record),
    categoryLabel: resolveOfferCategoryLabel(record),
    isSaved: asBoolean(record.isSaved),
    isPlanned: asBoolean(record.isPlanned),
    isPast: resolvePastState(record),
    // TODO: Уточнить business-метки статуса кампании/набора/акции.
    statusLabel: getNestedString(record, ["statusLabel"]),
  };
}
