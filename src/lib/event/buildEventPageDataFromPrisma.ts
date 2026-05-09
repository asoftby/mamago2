import type { ActivityFormat, EventVenueKind } from "@prisma/client";
import type { Intent } from "@/lib/intent";
import { DEFAULT_CITY_HUB_PATH } from "@/lib/intent";
import { extractPlainTextFromHtml } from "@/lib/richtext/utils";
import { sanitizeRichContent } from "@/components/content/RichContentRenderer";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import type { EventPageData } from "./eventPageTypes";
import {
  getActivityFormatDetailLabel,
  getActivityFormatLabel,
} from "@/domain/activities/activity-format";
import { ageFromPlusBadgeFromAgeTags } from "@/lib/event/activityAgeBounds";

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
  /** Денормализованный URL обложки; может дублировать запись по coverImageId в images */
  coverImageUrl: string | null;
  /** Primary: соответствует записи в images (ActivityImage.id) */
  coverImageId?: string | null;
  images: Array<{ id: string; url: string }>;
  sessions: Array<{ id: string; startsAt: Date }>;
  place: {
    id: string;
    slug: string | null;
    title: string;
    formattedAddr: string | null;
    city: { slug: string } | null;
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
      city: { slug: string } | null;
    } | null;
  } | null;
  eventCategory: { nameRu: string } | null;
};

function discoveryIntentForActivity(): Intent {
  return "kuda";
}

/** Если в `priceText` только число/фраза без валюты — дописываем BYN (как в карточке и визарде). */
function priceTextWithCurrencyIfNeeded(text: string): string {
  if (/\bbyn\b/i.test(text)) return text;
  const lower = text.toLowerCase();
  if (
    lower.includes("бесплатно") ||
    lower.includes("уточняйте") ||
    lower.includes("руб") ||
    /€|\$|£|₽/.test(text)
  ) {
    return text;
  }
  return `${text} BYN`;
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
  if (activity.ageTags.length > 0) {
    rows.push({
      id: "age",
      label: "Возраст",
      value: activity.ageTags.join(", "),
    });
  }
  if (activity.eventCategory?.nameRu) {
    rows.push({
      id: "cat",
      label: "Категория",
      value: activity.eventCategory.nameRu,
    });
  }
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
      return {
        name: v.place.title,
        address: v.place.formattedAddr ?? undefined,
        placeHref: publicPlaceHref(cityForPlace, v.place),
      };
    }
    if (v.title || v.addressLine) {
      return {
        name: v.title ?? activity.title,
        address: v.addressLine ?? undefined,
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
    return {
      name: activity.place.title,
      address: activity.place.formattedAddr ?? undefined,
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

  const data: EventPageData = {
    id: activity.id,
    slug: activity.slug ?? null,
    citySlug,
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
    cta: {
      planLabel: "В план",
      buyLabel: activity.format === "ONLINE" ? "Участвовать онлайн" : "Купить билет",
      saveLabel: "В идеи",
    },
    ownerEditHref: options?.ownerEditHref,
    previewBannerLabel: options?.previewBannerLabel,
    hidePublicationStats: options?.hidePublicationStats ?? true,
  };

  return data;
}
