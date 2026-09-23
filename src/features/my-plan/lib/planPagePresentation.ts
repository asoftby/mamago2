import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import type { PublicationPriceMode } from "@/domain/pricing/normalizedPrice";

export type PlanPresentationPlace = {
  title?: string | null;
  shortAddress: string | null;
  formattedAddr: string | null;
  customAddress: string | null;
};

export type PlanPresentationActivity = {
  ageMinMonths?: number | null;
  ageLabel: string | null;
  priceMode?: PublicationPriceMode | null;
  priceFrom: number | null;
  priceText: string | null;
  currency: string | null;
  place: PlanPresentationPlace | null;
  venue: {
    title?: string | null;
    addressLine: string | null;
    place: PlanPresentationPlace | null;
  } | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Compact public age for My Plan cards.
 * The stored ageLabel may contain every selected taxonomy bucket; the card
 * only needs the lower suitability boundary ("3+", "7+", "18+").
 */
export function formatPlanCardAge(
  ageMinMonths: number | null | undefined,
  rawAgeLabel: string | null,
): string | null {
  if (ageMinMonths != null && Number.isFinite(ageMinMonths) && ageMinMonths >= 0) {
    return `${Math.floor(ageMinMonths / 12)}+`;
  }

  const raw = rawAgeLabel?.trim();
  if (!raw) return null;

  const matches = [...raw.matchAll(/(?:^|[^\d])(\d{1,2})(?=\s*(?:\+|[-–—]|год|лет|года|$))/giu)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  if (matches.length > 0) return `${Math.min(...matches)}+`;
  if (/#[\s-]*nokids/i.test(raw)) return "18+";
  return null;
}

/**
 * My Plan uses the same public pricing contract as discovery cards.
 * Structured priceMode is authoritative: EXACT must not become "от", and
 * historical zero placeholders must not become "Бесплатно" unless mode=FREE.
 * The raw text fallback exists only for old/synthetic objects that predate
 * priceMode entirely.
 */
export function formatPlanCardPrice(activity: Pick<
  PlanPresentationActivity,
  "priceMode" | "priceFrom" | "priceText" | "currency"
>): string | null {
  const canonical = formatPublicCardPrice({
    priceMode: activity.priceMode,
    priceFrom: activity.priceFrom,
    currency: activity.currency,
  });
  if (canonical) return canonical;

  return activity.priceMode == null ? firstNonEmpty(activity.priceText) : null;
}

export function resolvePlanCardLocation(activity: Pick<
  PlanPresentationActivity,
  "place" | "venue"
>): { venueName: string | null; venueAddress: string | null } {
  const venueName = firstNonEmpty(
    activity.venue?.title,
    activity.venue?.place?.title,
    activity.place?.title,
  );

  const venueAddress = firstNonEmpty(
    activity.venue?.addressLine,
    activity.venue?.place?.shortAddress,
    activity.venue?.place?.formattedAddr,
    activity.venue?.place?.customAddress,
    activity.place?.shortAddress,
    activity.place?.formattedAddr,
    activity.place?.customAddress,
  );

  return {
    venueName,
    venueAddress:
      venueName && venueAddress?.toLocaleLowerCase("ru-RU") === venueName.toLocaleLowerCase("ru-RU")
        ? null
        : venueAddress,
  };
}

export function buildPlanCardPresentation(activity: PlanPresentationActivity): {
  ageLabel: string | null;
  priceLabel: string | null;
  venueName: string | null;
  venueAddress: string | null;
} {
  return {
    ageLabel: formatPlanCardAge(activity.ageMinMonths, activity.ageLabel),
    priceLabel: formatPlanCardPrice(activity),
    ...resolvePlanCardLocation(activity),
  };
}
