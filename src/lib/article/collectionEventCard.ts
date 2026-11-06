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

export type EventCardPlace = {
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
};

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
  /** Онлайн-событие места не имеет. */
  format?: string | null;
  title?: string | null;
  place: EventCardPlace | null;
  /** Своё место проведения события: приоритетнее связанной площадки. */
  venue?: {
    kind: string;
    title: string | null;
    addressLine: string | null;
    place: EventCardPlace | null;
  } | null;
};

export const EVENT_CARD_DESCRIPTION_MAX = 700;

/** Короткий простой текст из HTML-описания: без разметки, обрезка по границе слова. */
export function eventCardDescription(html: string | null | undefined, max: number = EVENT_CARD_DESCRIPTION_MAX): string | null {
  if (!html) return null;
  // extractPlainTextFromHtml склеивает соседние блоки без пробела («6+Стоимость»): ставим границы сами.
  const withBreaks = html.replace(/<\s*br\s*\/?>/gi, " ").replace(/<\/\s*(?:p|div|li|ul|ol|h[1-6]|tr|td|blockquote)\s*>/gi, " ");
  const text = extractPlainTextFromHtml(withBreaks).replace(/\s+/g, " ").trim();
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
  const venue = resolveEventCardVenue(a);
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
    venue,
    descriptionText: eventCardDescription(a.description),
    ageMinMonths: a.ageMinMonths,
    ageMaxMonths: a.ageMaxMonths,
  };
}

function placeVenue(p: EventCardPlace, name: string, address: string | null | undefined): ResolvedEventCardVenue {
  const citySlug = p.city?.slug ?? "minsk";
  const rawAddress = address ?? p.customAddress ?? p.formattedAddr ?? null;
  const formatted = rawAddress ? formatVenueAddressForPublicDisplay(rawAddress) : null;
  return {
    name,
    address: formatted || undefined,
    district: (p.districtManual ?? p.districtAuto)?.name || undefined,
    metro: (p.metroManual ?? p.metroAuto)?.name || undefined,
    href: p.slug || p.id ? `/${citySlug}/places/${p.slug ?? p.id}` : undefined,
  };
}

/** Те же правила, что `venueFromActivity` на странице события: venue.place → свой venue → связанная площадка. */
export function resolveEventCardVenue(a: Pick<EventCardSource, "format" | "title" | "place" | "venue">): ResolvedEventCardVenue | null {
  if (a.format === "ONLINE") return null;
  const v = a.venue;
  if (v) {
    if (v.kind === "PLACE" && v.place?.title?.trim()) {
      return placeVenue(v.place, v.place.title.trim(), null);
    }
    if (v.title?.trim() || v.addressLine?.trim()) {
      const linked = a.place;
      const name = v.title?.trim() || linked?.title?.trim() || a.title?.trim();
      if (name) {
        return linked
          ? placeVenue(linked, name, v.addressLine?.trim() || null)
          : { name, address: v.addressLine?.trim() ? formatVenueAddressForPublicDisplay(v.addressLine.trim()) || undefined : undefined };
      }
    }
  }
  const p = a.place;
  const placeName = p?.title?.trim();
  return p && placeName ? placeVenue(p, placeName, null) : null;
}
