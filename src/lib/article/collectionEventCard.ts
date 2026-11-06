import { formatAgeRange } from "@/lib/config/ages";

export type ResolvedEventCardData = {
  dateLabel: string;
  ageLabel: string | null;
  placeLabel: string | null;
  /** "Бесплатно" | "от N BYN" | null — цена неизвестна. */
  priceLabel: string | null;
  isFree: boolean;
  posterUrl: string | null;
};

const EVENT_DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Minsk" });

export function buildEventCardData(a: {
  nextOccurrenceAt: Date | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  priceFrom: number | null;
  priceTo?: number | null;
  currency: string | null;
  coverImageUrl: string | null;
  place: { title: string | null } | null;
}): ResolvedEventCardData {
  // «Бесплатно» только если платных тарифов нет: диапазон 0…N — это не бесплатное событие.
  const hasPaidTier = (a.priceTo ?? 0) > 0;
  const free = a.priceFrom === 0 && !hasPaidTier;
  const hasAge = a.ageMinMonths != null || a.ageMaxMonths != null;
  const raw = a.nextOccurrenceAt ? EVENT_DATE_FORMAT.format(a.nextOccurrenceAt) : "";
  return {
    dateLabel: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "",
    ageLabel: hasAge ? formatAgeRange(a.ageMinMonths, a.ageMaxMonths) : null,
    placeLabel: a.place?.title?.trim() || null,
    priceLabel: free
      ? "Бесплатно"
      : a.priceFrom === 0 && hasPaidTier
        ? `до ${a.priceTo} ${a.currency ?? "BYN"}`
        : a.priceFrom != null && a.priceFrom > 0
          ? `от ${a.priceFrom} ${a.currency ?? "BYN"}`
          : null,
    isFree: free,
    posterUrl: a.coverImageUrl,
  };
}
