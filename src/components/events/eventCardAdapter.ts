import type { ActivityFormat } from "@prisma/client";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { ActivityMock } from "@/types/activity";
import type { EventCardProps } from "./EventCard";

type EventListingSource = {
  id: string;
  title: string;
  slug?: string | null;
  citySlug: string;
  href?: string;
  imageUrl?: string | null;
  format?: ActivityFormat | null;
  badge?: string | null;
  ageFrom?: number | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  workingHours?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceListUsesOt?: boolean | null;
};

function buildPriceLabel(
  source: Pick<EventListingSource, "priceMin" | "priceMax" | "priceListUsesOt">,
): string | undefined {
  if (source.priceMin === 0) return "бесплатно";
  if (source.priceMin == null) return undefined;
  const useOt =
    source.priceListUsesOt ??
    !(
      source.priceMax != null &&
      source.priceMin != null &&
      source.priceMin === source.priceMax
    );
  return useOt ? formatPriceFrom(source.priceMin) : formatPrice(source.priceMin);
}

function buildCategoryLabel(
  source: Pick<EventListingSource, "badge" | "format">,
): string | undefined {
  const parts: (string | undefined)[] = [
    source.badge ?? undefined,
    source.format === "ONLINE" ? getActivityFormatLabel(source.format) : undefined,
  ];
  return parts.filter(Boolean).join(" · ") || undefined;
}

function buildMetaLabel(
  source: Pick<EventListingSource, "ageFrom" | "dateStart" | "dateEnd" | "workingHours">,
): string | undefined {
  const age = typeof source.ageFrom === "number" ? `${source.ageFrom}+` : undefined;
  const date = source.dateStart
    ? formatRuShortDayMonthRange(source.dateStart, source.dateEnd ?? null)
    : source.workingHours ?? undefined;
  return [age, date].filter(Boolean).join(" · ") || undefined;
}

function eventListingToEventCard(source: EventListingSource): EventCardProps {
  const href =
    source.href ??
    publicActivityPath(source.id, source.citySlug, source.slug);

  return {
    id: source.id,
    title: source.title,
    href,
    imageUrl: source.imageUrl ?? null,
    categoryLabel: buildCategoryLabel(source),
    metaLabel: buildMetaLabel(source),
    priceLabel: buildPriceLabel(source),
    saveMeta: {
      dateISO: source.dateStart ?? null,
      dateEndISO: source.dateEnd ?? null,
    },
  };
}

export function activityMockToEventCard(
  activity: ActivityMock,
  fallbackCitySlug: string,
): EventCardProps {
  return eventListingToEventCard({
    id: activity.id,
    title: activity.title,
    slug: activity.slug,
    citySlug: activity.citySlug ?? fallbackCitySlug,
    href: activity.href,
    imageUrl: activity.image ?? null,
    format: activity.format,
    badge: activity.badge ?? null,
    ageFrom: activity.ageFrom,
    dateStart: activity.dateStart ?? null,
    dateEnd: activity.dateEnd ?? null,
    workingHours: activity.workingHours ?? null,
    priceMin: activity.priceMin ?? null,
    priceMax: activity.priceMax ?? null,
    priceListUsesOt: activity.priceListUsesOt ?? null,
  });
}
