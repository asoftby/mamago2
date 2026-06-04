import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { ActivityMock } from "@/types/activity";
import type { EventCardProps } from "./EventCard";

// ─── Price caption ────────────────────────────────────────────────────────────

function buildPriceLabel(
  a: Pick<ActivityMock, "priceMin" | "priceMax" | "priceListUsesOt">,
): string | undefined {
  if (a.priceMin === 0) return "бесплатно";
  if (a.priceMin == null) return undefined;
  const useOt =
    a.priceListUsesOt ??
    !(a.priceMax != null && a.priceMin != null && a.priceMin === a.priceMax);
  return useOt ? formatPriceFrom(a.priceMin) : formatPrice(a.priceMin);
}

// ─── Category label ───────────────────────────────────────────────────────────
// Shows event category (e.g. "Спектакли"), appends "· Онлайн" only for online events.

function buildCategoryLabel(a: Pick<ActivityMock, "badge" | "format">): string | undefined {
  const parts: (string | undefined)[] = [
    a.badge ?? undefined,
    a.format === "ONLINE" ? getActivityFormatLabel(a.format) : undefined,
  ];
  return parts.filter(Boolean).join(" · ") || undefined;
}

// ─── Meta line ────────────────────────────────────────────────────────────────

function buildMetaLabel(
  a: Pick<ActivityMock, "ageFrom" | "dateStart" | "dateEnd" | "workingHours">,
): string | undefined {
  const age = typeof a.ageFrom === "number" ? `${a.ageFrom}+` : undefined;
  const date = a.dateStart
    ? formatRuShortDayMonthRange(a.dateStart, a.dateEnd ?? null)
    : a.workingHours ?? undefined;
  return [age, date].filter(Boolean).join(" · ") || undefined;
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

export function activityMockToEventCard(
  activity: ActivityMock,
  fallbackCitySlug: string,
): EventCardProps {
  const href =
    activity.href ??
    publicActivityPath(activity.id, activity.citySlug ?? fallbackCitySlug, activity.slug);

  return {
    id: activity.id,
    title: activity.title,
    href,
    imageUrl: activity.image ?? null,
    categoryLabel: buildCategoryLabel(activity),
    metaLabel: buildMetaLabel(activity),
    priceLabel: buildPriceLabel(activity),
    saveMeta: {
      dateISO: activity.dateStart ?? null,
      dateEndISO: activity.dateEnd ?? null,
    },
  };
}
