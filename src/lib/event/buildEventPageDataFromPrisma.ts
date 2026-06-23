import type { ActivityFormat, EventVenueKind } from "@prisma/client";
import type { Intent } from "@/lib/intent";
import { DEFAULT_CITY_HUB_PATH } from "@/lib/intent";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { extractPlainTextFromHtml } from "@/lib/richtext/utils";
import { sanitizeRichContent } from "@/components/content/RichContentRenderer";
import { resolvePlaceLogoUrl } from "@/lib/place/resolvePlaceLogoImage";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { BYN_SYMBOL, formatPriceAmount, formatPriceFrom } from "@/lib/formatters/format-price";
import type { EventPageData } from "./eventPageTypes";
import {
  getActivityFormatDetailLabel,
  getActivityFormatLabel,
} from "@/domain/activities/activity-format";
import { ageFromPlusBadgeFromAgeTags } from "@/lib/event/activityAgeBounds";
import { getActivityDateDisplay } from "@/lib/event/getActivityDateDisplay";
import { getNormalizedPhones, type NormalizedPhone } from "@/lib/phones/normalizePhones";
import { normalizeFaqItems } from "@/lib/faq/faqItems";

const FALLBACK_POSTER = "/og-default.jpg";

/**
 * Minimal activity shape for {@link buildEventPageDataFromPrismaActivity}
 * (matches a typical Prisma `include` for preview / public mapping).
 */
export type ActivityForEventPageInput = {
  /** Город листинга (публичная страница города) — для аналитики */
  cityId?: string | null;
  id: string;
  /** Публичный slug (может отсутствовать у черновика) */
  slug?: string | null;
  title: string;
  shortDesc: string;
  description: string | null;
  format: ActivityFormat;
  ageTags: string[];
  priceText: string | null;
  priceFrom: number | null;
  currency: string | null;
  priceDetails: string | null;
  faqItems?: unknown | null;
  scheduleJson?: unknown | null;
  /** Денормализованный URL обложки; может дублировать запись по coverImageId в images */
  coverImageUrl: string | null;
  /** Primary media asset id for cover image. */
  coverImageId?: string | null;
  images: Array<{ id: string; url: string; mediaAssetId?: string | null }>;
  sessions: Array<{ id: string; startsAt: Date }>;
  /** Контактные телефоны события (собственные, до фоллбэка на площадку) */
  phone?: string | null;
  phoneLabel?: string | null;
  phone2?: string | null;
  phone2Label?: string | null;
  phone3?: string | null;
  phone3Label?: string | null;
  place: {
    id: string;
    slug: string | null;
    title: string;
    formattedAddr: string | null;
    customAddress: string | null;
    lat: number | null;
    lng: number | null;
    logoImageId?: string | null;
    logoUrl?: string;
    images?: Array<{ id: string; url: string; kind: string }>;
    districtManual: { name: string } | null;
    districtAuto: { name: string } | null;
    metroManual: { name: string } | null;
    metroAuto: { name: string } | null;
    city: { slug: string } | null;
    phone?: string | null;
    phoneLabel?: string | null;
    phone2?: string | null;
    phone2Label?: string | null;
    phone3?: string | null;
    phone3Label?: string | null;
  } | null;
  venue: {
    kind: EventVenueKind;
    title: string | null;
    addressLine: string | null;
    place: {
      id: string;
      slug: string | null;
      title: string;
      formattedAddr: string | null;
      customAddress: string | null;
      lat: number | null;
      lng: number | null;
      logoImageId: string | null;
      logoUrl?: string;
      images: Array<{ id: string; url: string; kind: string }>;
      districtManual: { name: string } | null;
      districtAuto: { name: string } | null;
      metroManual: { name: string } | null;
      metroAuto: { name: string } | null;
      city: { slug: string } | null;
      phone?: string | null;
      phoneLabel?: string | null;
      phone2?: string | null;
      phone2Label?: string | null;
      phone3?: string | null;
      phone3Label?: string | null;
    } | null;
  } | null;
  eventCategory: { nameRu: string } | null;
};

function discoveryIntentForActivity(): Intent {
  return "kuda";
}

function normalizePriceCurrencyText(text: string): string {
  return text
    .replace(/\bBYN\b/gi, BYN_SYMBOL)
    .replace(/\bBr\b/gi, BYN_SYMBOL)
    .replace(/руб\.?/gi, BYN_SYMBOL)
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Если в `priceText` только число/фраза без валюты — дописываем единый символ валюты. */
function priceTextWithCurrencyIfNeeded(text: string): string {
  if (/\bbyn\b/i.test(text) || /\bbr\b/i.test(text) || /руб\.?/i.test(text) || text.includes(BYN_SYMBOL)) {
    return normalizePriceCurrencyText(text);
  }
  const lower = text.toLowerCase();
  if (
    lower.includes("бесплатно") ||
    lower.includes("уточняйте") ||
    /€|\$|£|₽/.test(text)
  ) {
    return text;
  }
  // Если это чистое число (напр. "15" или "15.50") — форматируем через formatPriceAmount,
  // чтобы получить "15,00" с фиксированными двумя знаками после запятой.
  const numStr = formatPriceAmount(text);
  if (numStr) return `${numStr} ${BYN_SYMBOL}`;
  return `${text} ${BYN_SYMBOL}`;
}

function priceLabel(activity: Pick<ActivityForEventPageInput, "priceText" | "priceFrom" | "currency">): string {
  const t = activity.priceText?.trim();
  if (t) return priceTextWithCurrencyIfNeeded(t);
  if (activity.priceFrom === 0) return "Бесплатно";
  if (activity.priceFrom != null) {
    return formatPriceFrom(activity.priceFrom);
  }
  return "Уточняйте цену";
}

function resolveActivityPhones(activity: ActivityForEventPageInput): NormalizedPhone[] {
  const ownPhones = getNormalizedPhones({
    phone: activity.phone,
    phoneLabel: activity.phoneLabel,
    phone2: activity.phone2,
    phone2Label: activity.phone2Label,
    phone3: activity.phone3,
    phone3Label: activity.phone3Label,
  });
  if (ownPhones.length > 0) return ownPhones;

  const fallbackPlace = activity.place ?? activity.venue?.place ?? null;
  return fallbackPlace ? getNormalizedPhones(fallbackPlace) : [];
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function resolvePurchaseUrl(activity: Pick<ActivityForEventPageInput, "scheduleJson">): string | undefined {
  const raw = activity.scheduleJson;
  if (!raw || typeof raw !== "object") return undefined;
  const json = raw as Record<string, unknown>;
  const participationMode =
    typeof json.participationMode === "string" ? json.participationMode : undefined;
  if (participationMode === "external-link") {
    const ticketLink = typeof json.ticketLink === "string" ? json.ticketLink.trim() : "";
    return ticketLink && isHttpUrl(ticketLink) ? ticketLink : undefined;
  }
  if (participationMode === "prebook") {
    const prebookMethod =
      typeof json.prebookMethod === "string" ? json.prebookMethod : undefined;
    const prebookUrl = typeof json.prebookUrl === "string" ? json.prebookUrl.trim() : "";
    if (prebookMethod === "link" && prebookUrl && isHttpUrl(prebookUrl)) {
      return prebookUrl;
    }
  }
  return undefined;
}

function resolveSimpleBooking(
  activityId: string,
  activity: Pick<ActivityForEventPageInput, "scheduleJson">,
): import("@/lib/event/eventPageTypes").EventSimpleBookingData | undefined {
  const raw = activity.scheduleJson;
  if (!raw || typeof raw !== "object") return undefined;
  const json = raw as Record<string, unknown>;
  const mode = json.participationMode;

  if (mode === "simple-booking") {
    return {
      activityId,
      date: typeof json.simpleBookingDate === "string" ? json.simpleBookingDate : undefined,
      time: typeof json.simpleBookingTime === "string" ? json.simpleBookingTime : undefined,
    };
  }

  if (mode === "time-slots") {
    const ts = json.timeSlots as { dates?: Array<{ id: string; isoDate: string; slots: Array<{ id: string; startTime: string; endTime?: string; capacity?: number }> }> } | undefined;
    const slots = (ts?.dates ?? []).flatMap((d) =>
      (d.slots ?? []).map((s) => ({
        id: s.id,
        isoDate: d.isoDate,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
      })),
    );
    if (slots.length === 0) return undefined;
    return { activityId, slots };
  }

  return undefined;
}

function factChipsFromActivity(activity: ActivityForEventPageInput): EventPageData["factChips"] {
  const chips: EventPageData["factChips"] = [];
  /** Офлайн — базовый сценарий, отдельный бэйдж не показываем. */
  if (activity.format !== "OFFLINE") {
    chips.push({
      id: "format",
      label: getActivityFormatLabel(activity.format),
    });
  }
  return chips;
}

function importantFactsFromActivity(activity: ActivityForEventPageInput): EventPageData["importantFacts"] {
  const rows: EventPageData["importantFacts"] = [];

  // 01 Дата
  const activityDateDisplay = getActivityDateDisplay(activity);
  if (activityDateDisplay) {
    rows.push({
      id: "date",
      label: "Дата",
      value: activityDateDisplay,
    });
  }

  // 02 Возраст
  const ageBadge = ageFromPlusBadgeFromAgeTags(activity.ageTags);
  if (ageBadge) {
    rows.push({
      id: "age",
      label: "Возраст",
      value: ageBadge,
    });
  }

  // 03 Время начала
  if (activity.sessions.length > 0) {
    const uniqueTimes = [
      ...new Set(
        activity.sessions.map((s) =>
          new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(s.startsAt),
        ),
      ),
    ];
    rows.push({
      id: "time",
      label: "Время начала",
      value: uniqueTimes.join(", "),
    });
  }

  // 04 Формат
  rows.push({
    id: "format",
    label: "Формат",
    value: getActivityFormatDetailLabel(activity.format),
  });

  return rows;
}

function eventVenueCitySlug(activity: ActivityForEventPageInput): string {
  return (
    activity.place?.city?.slug ??
    activity.venue?.place?.city?.slug ??
    DEFAULT_CITY_HUB_PATH.replace(/^\//, "")
  );
}

function publicPlaceHref(
  citySlug: string,
  place: { id: string; slug: string | null },
): string {
  const seg = encodeURIComponent(place.slug ?? place.id);
  return `/${citySlug}/places/${seg}`;
}

function venueFromActivity(
  activity: ActivityForEventPageInput,
  listingCitySlug: string,
): EventPageData["venue"] | undefined {
  const fallbackCity = eventVenueCitySlug(activity);

  if (activity.venue) {
    if (activity.format === "ONLINE") return undefined;
    const v = activity.venue;
    if (v.kind === "PLACE" && v.place) {
      const cityForPlace = v.place.city?.slug ?? listingCitySlug ?? fallbackCity;
      const logoUrl =
        v.place.logoUrl ?? resolvePlaceLogoUrl(v.place.images, v.place.logoImageId);
      return {
        name: v.place.title,
        logoUrl,
        address: v.place.customAddress ?? v.place.formattedAddr ?? undefined,
        lat: v.place.lat ?? undefined,
        lng: v.place.lng ?? undefined,
        district: (v.place.districtManual ?? v.place.districtAuto)?.name ?? undefined,
        metro: (v.place.metroManual ?? v.place.metroAuto)?.name ?? undefined,
        placeHref: publicPlaceHref(cityForPlace, v.place),
      };
    }
    if (v.title || v.addressLine) {
      const linkedPlace = activity.place;
      const cityForPlace = linkedPlace?.city?.slug ?? listingCitySlug ?? fallbackCity;
      const logoUrl = linkedPlace
        ? linkedPlace.logoUrl ??
          resolvePlaceLogoUrl(linkedPlace.images, linkedPlace.logoImageId)
        : undefined;

      return {
        name: v.title ?? linkedPlace?.title ?? activity.title,
        logoUrl,
        address:
          v.addressLine ??
          linkedPlace?.customAddress ??
          linkedPlace?.formattedAddr ??
          undefined,
        lat: linkedPlace?.lat ?? undefined,
        lng: linkedPlace?.lng ?? undefined,
        district: (linkedPlace?.districtManual ?? linkedPlace?.districtAuto)?.name ?? undefined,
        metro: (linkedPlace?.metroManual ?? linkedPlace?.metroAuto)?.name ?? undefined,
        placeHref: linkedPlace ? publicPlaceHref(cityForPlace, linkedPlace) : undefined,
        mapUrl:
          v.addressLine != null && v.addressLine.length > 0
            ? `https://maps.google.com/?q=${encodeURIComponent(v.addressLine)}`
            : undefined,
      };
    }
  }
  if (activity.place) {
    if (activity.format === "ONLINE") return undefined;
    const cityForPlace = activity.place.city?.slug ?? listingCitySlug ?? fallbackCity;
    const logoUrl =
      activity.place.logoUrl ??
      resolvePlaceLogoUrl(activity.place.images, activity.place.logoImageId);
    return {
      name: activity.place.title,
      logoUrl,
      address: activity.place.customAddress ?? activity.place.formattedAddr ?? undefined,
      lat: activity.place.lat ?? undefined,
      lng: activity.place.lng ?? undefined,
      district: (activity.place.districtManual ?? activity.place.districtAuto)?.name ?? undefined,
      metro: (activity.place.metroManual ?? activity.place.metroAuto)?.name ?? undefined,
      placeHref: publicPlaceHref(cityForPlace, activity.place),
    };
  }
  return undefined;
}

function aboutFromActivity(activity: ActivityForEventPageInput): EventPageData["about"] {
  const raw = activity.description ?? "";
  const fullPlain = raw ? extractPlainTextFromHtml(raw) : "";
  const summary =
    fullPlain.length > 220 ? `${fullPlain.slice(0, 217)}…` : fullPlain || activity.shortDesc;
  
  return {
    summary,
    full: fullPlain.length > 220 ? fullPlain : undefined,
    // Safe HTML for public/owner preview (allowlist matches TipTap output)
    descriptionHtml: raw ? sanitizeRichContent(raw) : undefined,
  };
}

function bulletsFromText(text: string, maxLen: number): string[] {
  const t = text.trim();
  if (!t) return ["Проверьте расписание и детали перед визитом."];
  const line = t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
  return [line, "Формат подходит для семейного досуга.", "Уточняйте детали у организатора при необходимости."];
}

/**
 * Maps a Prisma Activity (event) row to the public event page view model (owner preview / future public page).
 */
export function buildEventPageDataFromPrismaActivity(
  activity: ActivityForEventPageInput,
  options?: {
    citySlug?: string;
    previewBannerLabel?: string;
    hidePublicationStats?: boolean;
    ownerEditHref?: string;
    /** Pre-fetched Instagram Reels thumbnail URL (og:image from the Reel page). */
    reelsThumbnailUrl?: string;
  }
): EventPageData {
  const citySlug =
    options?.citySlug ??
    activity.place?.city?.slug ??
    activity.venue?.place?.city?.slug ??
    DEFAULT_CITY_HUB_PATH.replace(/^\//, "");

  const poster =
    resolveActivityCoverUrl({
      coverImageId: activity.coverImageId ?? null,
      coverImageUrl: activity.coverImageUrl,
      images: activity.images,
    }) ?? FALLBACK_POSTER;

  const sessions: EventPageData["sessions"] = activity.sessions.map((s) => ({
    id: s.id,
    startsAt: s.startsAt.toISOString(),
  }));

  const plainDesc = activity.description
    ? extractPlainTextFromHtml(activity.description)
    : "";

  const now = new Date();
  const isPastEvent =
    sessions.length > 0 && sessions.every((s) => new Date(s.startsAt) < now);

  const data: EventPageData = {
    id: activity.id,
    slug: activity.slug ?? null,
    citySlug,
    isPastEvent,
    discoveryIntent: discoveryIntentForActivity(),
    ageFromBadge: ageFromPlusBadgeFromAgeTags(activity.ageTags),
    categoryLabel: activity.eventCategory?.nameRu,
    title: activity.title,
    subtitle: activity.shortDesc,
    factChips: factChipsFromActivity(activity),
    importantFacts: importantFactsFromActivity(activity),
    media: {
      posterUrl: poster,
      posterAlt: activity.title,
    },
    sessions,
    venue: venueFromActivity(activity, citySlug),
    whyGo: bulletsFromText(plainDesc || activity.shortDesc, 160),
    goodFit: [
      `Если вы ищете событие с указанным возрастом: ${activity.ageTags.join(", ") || "см. описание"}.`,
      "Если хотите заранее спланировать визит.",
      "Если вам важны понятные условия участия.",
    ],
    about: aboutFromActivity(activity),
    planDayLinks: {},
    similar: [],
    breadcrumbs: [
      { label: "Главная", href: `/${citySlug}` },
      { label: "События", href: `/${citySlug}/kuda` },
      { label: activity.title, href: "#" },
    ],
    priceLabel: priceLabel(activity),
    priceDetails: activity.priceDetails ?? undefined,
    faqItems: normalizeFaqItems(activity.faqItems),
    cta: {
      planLabel: "В план",
      buyLabel: activity.format === "ONLINE" ? "Участвовать онлайн" : "Купить билет",
      saveLabel: "В идеи",
      purchaseUrl: resolvePurchaseUrl(activity),
      simpleBooking: resolveSimpleBooking(activity.id, activity),
      phones: resolveActivityPhones(activity),
    },
    reelsUrl: resolveReelsUrl(activity),
    galleryItems: buildGalleryItems(activity, poster, options?.reelsThumbnailUrl),
    ownerEditHref: options?.ownerEditHref,
    previewBannerLabel: options?.previewBannerLabel,
    hidePublicationStats: options?.hidePublicationStats ?? true,
  };

  return data;
}

function resolveReelsUrl(activity: Pick<ActivityForEventPageInput, "scheduleJson">): string | undefined {
  const raw = activity.scheduleJson;
  if (!raw || typeof raw !== "object") return undefined;
  const json = raw as Record<string, unknown>;
  const url = typeof json.reelsUrl === "string" ? json.reelsUrl.trim() : "";
  return url && isHttpUrl(url) ? url : undefined;
}

/**
 * Builds the gallery strip items shown under the cover image:
 * [reels?, ...extra photos (excl. cover)]
 */
function buildGalleryItems(
  activity: ActivityForEventPageInput,
  resolvedPosterUrl: string,
  reelsThumbnailUrl?: string,
): MediaGalleryItem[] | undefined {
  const reelsUrl = resolveReelsUrl(activity);

  // Extra gallery images = all images except the one used as cover
  const rawImages = activity.images ?? [];
  const coverId = activity.coverImageId?.trim();

  const extraImages = rawImages.filter((img) => {
    if (!img.url?.trim()) return false;
    if (coverId) {
      if (img.id === coverId || (img as { mediaAssetId?: string | null }).mediaAssetId === coverId) {
        return false;
      }
    }
    // Also exclude by resolved URL match (covers legacy coverImageUrl path)
    if (img.url === resolvedPosterUrl) return false;
    return true;
  });

  const items: MediaGalleryItem[] = [];

  if (reelsUrl) {
    const thumbnailSrc =
      reelsThumbnailUrl ??
      (resolvedPosterUrl !== "/og-default.jpg" ? resolvedPosterUrl : undefined);
    items.push({
      type: "reels",
      id: "reels",
      url: reelsUrl,
      thumbnailSrc,
      title: "Reels о событии",
    });
  }

  for (const img of extraImages) {
    items.push({
      type: "image",
      id: img.id,
      src: img.url,
      alt: activity.title,
    });
  }

  return items.length > 0 ? items : undefined;
}
