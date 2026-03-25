import type { EventVenueKind } from "@prisma/client";
import type { Intent } from "@/lib/intent";
import { DEFAULT_CITY_HUB_PATH } from "@/lib/intent";
import { extractPlainTextFromHtml } from "@/lib/richtext/utils";
import type { EventPageData } from "./eventPageTypes";

const FALLBACK_POSTER = "/mock/activity/anderson.svg";

/**
 * Minimal activity shape for {@link buildEventPageDataFromPrismaActivity}
 * (matches a typical Prisma `include` for preview / public mapping).
 */
export type ActivityForEventPageInput = {
  id: string;
  title: string;
  shortDesc: string;
  description: string | null;
  ageTags: string[];
  priceText: string | null;
  priceFrom: number | null;
  currency: string | null;
  priceDetails: string | null;
  coverImageUrl: string | null;
  images: Array<{ id: string; url: string }>;
  sessions: Array<{ id: string; startsAt: Date }>;
  place: {
    title: string;
    formattedAddr: string | null;
    city: { slug: string } | null;
  } | null;
  venue: {
    kind: EventVenueKind;
    title: string | null;
    addressLine: string | null;
    place: { title: string; formattedAddr: string | null } | null;
  } | null;
  eventCategory: { nameRu: string } | null;
};

function discoveryIntentForActivity(): Intent {
  return "kuda";
}

function priceLabel(activity: Pick<ActivityForEventPageInput, "priceText" | "priceFrom" | "currency">): string {
  const t = activity.priceText?.trim();
  if (t) return t;
  if (activity.priceFrom === 0) return "Бесплатно";
  if (activity.priceFrom != null) {
    const cur = activity.currency ?? "BYN";
    return `от ${activity.priceFrom} ${cur}`;
  }
  return "Уточняйте цену";
}

function factChipsFromActivity(activity: ActivityForEventPageInput): EventPageData["factChips"] {
  const chips: EventPageData["factChips"] = [];
  for (const tag of activity.ageTags.slice(0, 4)) {
    chips.push({
      id: `age-${tag}`,
      label: tag.includes("–") || tag.includes("-") ? `${tag} лет` : tag,
    });
  }
  if (chips.length === 0) {
    chips.push({ id: "fmt", label: "Событие" });
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
  return rows;
}

function venueFromActivity(activity: ActivityForEventPageInput): EventPageData["venue"] | undefined {
  if (activity.venue) {
    const v = activity.venue;
    if (v.kind === "PLACE" && v.place) {
      return {
        name: v.place.title,
        address: v.place.formattedAddr ?? undefined,
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
    return {
      name: activity.place.title,
      address: activity.place.formattedAddr ?? undefined,
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
  }
): EventPageData {
  const citySlug =
    options?.citySlug ??
    activity.place?.city?.slug ??
    DEFAULT_CITY_HUB_PATH.replace(/^\//, "");

  const poster =
    activity.images[0]?.url ?? activity.coverImageUrl ?? FALLBACK_POSTER;

  const sessions: EventPageData["sessions"] = activity.sessions.map((s) => ({
    id: s.id,
    startsAt: s.startsAt.toISOString(),
  }));

  const plainDesc = activity.description
    ? extractPlainTextFromHtml(activity.description)
    : "";

  const data: EventPageData = {
    id: activity.id,
    citySlug,
    discoveryIntent: discoveryIntentForActivity(),
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
    venue: venueFromActivity(activity),
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
      { label: "События", href: `/${citySlug}` },
      { label: activity.title, href: "#" },
    ],
    priceLabel: priceLabel(activity),
    priceDetails: activity.priceDetails ?? undefined,
    cta: {
      planLabel: "В план",
      buyLabel: "Купить билет",
      saveLabel: "В идеи",
    },
    previewBannerLabel: options?.previewBannerLabel,
    hidePublicationStats: options?.hidePublicationStats ?? true,
  };

  return data;
}
