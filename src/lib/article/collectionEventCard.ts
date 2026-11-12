import { buildCollectionEventMedia } from "@/lib/article/collectionEventMedia";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { formatAgeRange, formatAgeTagsCompact } from "@/lib/config/ages";
import { ageFromPlusBadgeFromAgeTags } from "@/lib/event/activityAgeBounds";
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
  mediaItems: MediaGalleryItem[];
  venue: ResolvedEventCardVenue | null;
  /** Описание обычным текстом для «шторки»; без HTML. */
  descriptionText: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
};

type NamedRef = { name: string } | null | undefined;

type EventCardPlace = {
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
  title?: string;
  nextOccurrenceAt: Date | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  ageTags?: string[];
  agePolicy?: string | null;
  priceFrom: number | null;
  priceTo?: number | null;
  currency: string | null;
  coverImageUrl: string | null;
  coverImageId?: string | null;
  images?: Array<{ id: string; url: string; mediaAssetId?: string | null }>;
  scheduleJson?: unknown;
  description?: string | null;
  eventCategory?: { nameRu: string | null } | null;
  format?: string | null;
  place: EventCardPlace | null;
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
  const text = extractPlainTextFromHtml(html).replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Resolve the physical venue with the same priority as the event landing page. */
export function resolveCollectionEventVenue(a: EventCardSource): ResolvedEventCardVenue | null {
  if (a.format === "ONLINE") return null;
  const venue = a.venue;
  const actualVenuePlace = venue?.kind === "PLACE" && venue.place ? venue.place : null;
  const linkedPlace = a.place;
  const place = actualVenuePlace ?? linkedPlace;
  const explicitAddress = venue?.addressLine?.trim() || null;
  const hasCustomVenue = !actualVenuePlace && Boolean(venue?.title?.trim() || explicitAddress);
  const name = actualVenuePlace?.title?.trim()
    || (hasCustomVenue ? venue?.title?.trim() || linkedPlace?.title?.trim() || a.title?.trim() : null)
    || linkedPlace?.title?.trim();
  if (!name) return null;

  // A custom event address can differ from Activity.place. Never show a
  // misleading place link, district or metro for that other address.
  const matchesLinkedAddress = explicitAddress != null &&
    [linkedPlace?.customAddress, linkedPlace?.formattedAddr].some((value) => value?.trim() === explicitAddress);
  const placeForLocation = hasCustomVenue && explicitAddress && !matchesLinkedAddress ? null : place;
  const rawAddress = actualVenuePlace
    ? actualVenuePlace.customAddress ?? actualVenuePlace.formattedAddr ?? null
    : explicitAddress ?? place?.customAddress ?? place?.formattedAddr ?? null;
  const address = rawAddress ? formatVenueAddressForPublicDisplay(rawAddress) : null;
  const citySlug = placeForLocation?.city?.slug ?? "minsk";

  return {
    name,
    address: address || undefined,
    district: (placeForLocation?.districtManual ?? placeForLocation?.districtAuto)?.name || undefined,
    metro: (placeForLocation?.metroManual ?? placeForLocation?.metroAuto)?.name || undefined,
    href: placeForLocation?.slug || placeForLocation?.id
      ? `/${citySlug}/places/${encodeURIComponent(placeForLocation.slug ?? placeForLocation.id!)}`
      : undefined,
  };
}

export function buildEventCardData(a: EventCardSource): ResolvedEventCardData {
  // «Бесплатно» только если платных тарифов нет: диапазон 0…N — это не бесплатное событие.
  const hasPaidTier = (a.priceTo ?? 0) > 0;
  const free = a.priceFrom === 0 && !hasPaidTier;
  const hasAge = a.ageMinMonths != null || a.ageMaxMonths != null;
  const [dateLabel = "", timeLabel = ""] = a.nextOccurrenceAt ? formatRuSessionHero(a.nextOccurrenceAt.toISOString()).split(" · ") : [];
  return {
    dateLabel,
    timeLabel: timeLabel || null,
    categoryLabel: a.eventCategory?.nameRu?.trim() || null,
    ageLabel: a.agePolicy === "ADULT_ONLY"
      ? "18+"
      : formatAgeTagsCompact(a.ageTags) ?? ageFromPlusBadgeFromAgeTags(a.ageTags ?? []) ?? (hasAge ? formatAgeRange(a.ageMinMonths, a.ageMaxMonths) : a.agePolicy === "UNRESTRICTED" ? "Любой возраст" : null),
    priceLabel: free
      ? "Бесплатно"
      : a.priceFrom === 0 && hasPaidTier
        ? `до ${a.priceTo} ${a.currency ?? "BYN"}`
        : a.priceFrom != null && a.priceFrom > 0
          ? `от ${a.priceFrom} ${a.currency ?? "BYN"}`
          : null,
    isFree: free,
    posterUrl: a.coverImageUrl,
    mediaItems: buildCollectionEventMedia({ title: a.title ?? "Событие", ...a }),
    venue: resolveCollectionEventVenue(a),
    descriptionText: eventCardDescription(a.description),
    ageMinMonths: a.ageMinMonths,
    ageMaxMonths: a.ageMaxMonths,
  };
}
