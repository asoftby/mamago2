import { formatAgeRange } from "@/lib/config/ages";
import { formatRuSessionHero } from "@/lib/event/eventPageFormat";
import { formatVenueAddressForPublicDisplay } from "@/lib/event/formatVenueAddressForDisplay";
import { extractPlainTextFromHtml } from "@/lib/richtext/utils";

export type ResolvedEventCardVenue = {
  name: string;
  address?: string;
  district?: string;
  metro?: string;
  /** Страница места: /{city}/places/{slug|id}. */
  href?: string;
};

export type ResolvedEventCardData = {
  /** «сб, 7 ноя. 2026» — ближайший сеанс; пусто, если даты нет. */
  dateLabel: string;
  /** «11:30» — время начала ближайшего сеанса. */
  timeLabel: string | null;
  categoryLabel: string | null;
  ageLabel: string | null;
  /** "Бесплатно" | "от N BYN" | null — цена неизвестна. */
  priceLabel: string | null;
  isFree: boolean;
  posterUrl: string | null;
  venue: ResolvedEventCardVenue | null;
  /** Описание обычным текстом для «шторки»; без HTML. */
  descriptionText: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
};

type NamedRef = { name: string } | null | undefined;

export type EventCardSource = {
  nextOccurrenceAt: Date | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  priceFrom: number | null;
  priceTo?: number | null;
  currency: string | null;
  coverImageUrl: string | null;
  description?: string | null;
  eventCategory?: { nameRu: string | null } | null;
  place: {
    id?: string;
    slug?: string | null;
    title: string | null;
    customAddress?: string | null;
    formattedAddr?: string | null;
    districtManual?: NamedRef;
    districtAuto?: NamedRef;
    metroManual?: NamedRef;
    metroAuto?: NamedRef;
    city?: { slug: string } | null;
  } | null;
};

export const EVENT_CARD_DESCRIPTION_MAX = 700;

/** Короткий простой текст из HTML-описания: без разметки, обрезка по границе слова. */
export function eventCardDescription(html: string | null | undefined, max: number = EVENT_CARD_DESCRIPTION_MAX): string | null {
  if (!html) return null;
  const text = extractPlainTextFromHtml(html).replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

export function buildEventCardData(a: EventCardSource): ResolvedEventCardData {
  // «Бесплатно» только если платных тарифов нет: диапазон 0…N — это не бесплатное событие.
  const hasPaidTier = (a.priceTo ?? 0) > 0;
  const free = a.priceFrom === 0 && !hasPaidTier;
  const hasAge = a.ageMinMonths != null || a.ageMaxMonths != null;
  const [dateLabel = "", timeLabel = ""] = a.nextOccurrenceAt ? formatRuSessionHero(a.nextOccurrenceAt.toISOString()).split(" · ") : [];
  const p = a.place;
  const placeName = p?.title?.trim();
  const rawAddress = p?.customAddress ?? p?.formattedAddr ?? null;
  const address = rawAddress ? formatVenueAddressForPublicDisplay(rawAddress) : null;
  const citySlug = p?.city?.slug ?? "minsk";
  return {
    dateLabel,
    timeLabel: timeLabel || null,
    categoryLabel: a.eventCategory?.nameRu?.trim() || null,
    ageLabel: hasAge ? formatAgeRange(a.ageMinMonths, a.ageMaxMonths) : null,
    priceLabel: free
      ? "Бесплатно"
      : a.priceFrom === 0 && hasPaidTier
        ? `до ${a.priceTo} ${a.currency ?? "BYN"}`
        : a.priceFrom != null && a.priceFrom > 0
          ? `от ${a.priceFrom} ${a.currency ?? "BYN"}`
          : null,
    isFree: free,
    posterUrl: a.coverImageUrl,
    venue: placeName
      ? {
          name: placeName,
          address: address || undefined,
          district: (p?.districtManual ?? p?.districtAuto)?.name || undefined,
          metro: (p?.metroManual ?? p?.metroAuto)?.name || undefined,
          href: p?.slug || p?.id ? `/${citySlug}/places/${p.slug ?? p.id}` : undefined,
        }
      : null,
    descriptionText: eventCardDescription(a.description),
    ageMinMonths: a.ageMinMonths,
    ageMaxMonths: a.ageMaxMonths,
  };
}
