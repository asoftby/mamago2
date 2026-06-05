"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { H3, Caption } from "@/components/ui/typography";
import { SaveHeart } from "@/features/save/SaveHeart";
import { SaveToPlanResult } from "./SaveToPlanModal";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import type { ActivityFormat } from "@prisma/client";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";

type DomainActivity = {
  id: string;
  /** Публичный slug события; если нет — в ссылке используется id */
  slug?: string | null;
  /** Канонический city slug для публичной страницы события. */
  citySlug?: string | null;
  href?: string;
  format?: ActivityFormat | null;
  title: string;
  image: string;
  coverImage?: string | null;
  ageFrom?: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  workingHours?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  /** true = «от X BYN»; false = «X BYN»; если не задано — эвристика по priceMin === priceMax */
  priceListUsesOt?: boolean | null;
  currency?: string | null;
  badge?: string | null;
  /** Нейтральный гео-бейдж (область / пригород), не путать с категорией */
  geoBadge?: string | null;
  /** Подсказка по возрастной аудитории (второй слой ленты) */
  ageHintBadge?: string | null;
  rating?: number | null;
  /** Показываем ★ только при reviewsCount > 0 */
  reviewsCount?: number | null;
};

function discoveryCardPriceCaption(
  a: Pick<
    DomainActivity,
    "priceMin" | "priceMax" | "currency" | "priceListUsesOt"
  >,
): string | null {
  if (a.priceMin === 0) return "бесплатно";
  if (a.priceMin == null) return null;
  const useOt =
    a.priceListUsesOt ??
    !(
      a.priceMax != null &&
      a.priceMin != null &&
      a.priceMin === a.priceMax
    );
  return useOt ? formatPriceFrom(a.priceMin) : formatPrice(a.priceMin);
}

export type ActivitySaveMeta = {
  title: string;
  dateISO?: string | null;
  dateEndISO?: string | null;
  dateLabel?: string | null;
  timeSlots?: { id: string; label: string }[] | null;
  timeLabel?: string | null;
  source?: string;
};

type AdapterProps =
  | {
      activity: DomainActivity;
      className?: string;
      /** Соотношение сторон обложки, по умолчанию `4/5` */
      coverRatio?: string;
      variant?: "default" | "poster-feed";
      saveMeta?: ActivitySaveMeta;
      onSaveResult?: (result: SaveToPlanResult) => void;
    }
  | {
      id: string;
      title: string;
      image: string;
      age?: string;
      dateLabel?: string;
      priceLabel?: string;
      badge?: string;
      format?: ActivityFormat | null;
      rating?: number;
      reviewsCount?: number;
      className?: string;
      coverRatio?: string;
      variant?: "default" | "poster-feed";
      saveMeta?: ActivitySaveMeta;
      onSaveResult?: (result: SaveToPlanResult) => void;
    };

export function ActivityCard(props: AdapterProps) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const coverRatio = props.coverRatio ?? "4/5";
  const variant = props.variant ?? "default";
  const activityDateEnd =
    "activity" in props ? props.activity.dateEnd ?? null : null;

  const base =
    "activity" in props
      ? {
          id: props.activity.id,
          slug: props.activity.slug,
          citySlug: props.activity.citySlug,
          href: props.activity.href,
          format: props.activity.format,
          title: props.activity.title,
          image: props.activity.coverImage ?? props.activity.image ?? null,
          meta: [
            typeof props.activity.ageFrom === "number" ? `${props.activity.ageFrom}+` : null,
            props.activity.dateStart
              ? formatRuShortDayMonthRange(
                  props.activity.dateStart,
                  props.activity.dateEnd ?? null,
                )
              : props.activity.workingHours || null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
          priceText: discoveryCardPriceCaption(props.activity) ?? undefined,
          geoBadge: props.activity.geoBadge ?? undefined,
          ageHintBadge: props.activity.ageHintBadge ?? undefined,
          badges: (props.activity.badge ? [props.activity.badge] : []) as string[],
          rating: props.activity.rating ?? undefined,
          reviewsCount: props.activity.reviewsCount ?? undefined,
          className: props.className,
          dateStart: props.activity.dateStart,
          saveMeta: props.saveMeta,
          onSaveResult: props.onSaveResult,
        }
      : {
          id: props.id,
          slug: undefined,
          citySlug: undefined,
          href: undefined,
          format: props.format ?? null,
          title: props.title,
          image: props.image,
          meta: [
            props.age || null,
            props.dateLabel || null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
          priceText: normalizeUiCurrencyText(props.priceLabel ?? undefined) || undefined,
          geoBadge: undefined,
          ageHintBadge: undefined,
          badges: props.badge ? [props.badge] : [],
          rating: props.rating,
          reviewsCount: props.reviewsCount,
          className: props.className,
          dateStart: null,
          saveMeta: props.saveMeta,
          onSaveResult: props.onSaveResult,
        };

  const href = base.href ?? publicActivityPath(base.id, base.citySlug ?? city, base.slug);

  const showRating =
    typeof base.rating === "number" &&
    ("activity" in props
      ? (base.reviewsCount ?? 0) > 0
      : base.reviewsCount === undefined || (base.reviewsCount ?? 0) > 0);
  const ratingStr = showRating
    ? base.rating!.toFixed(1).replace(".", ",")
    : undefined;
  const metaText = [base.meta, ratingStr ? `★ ${ratingStr}` : null]
    .filter(Boolean)
    .join(" · ");

  if (variant === "poster-feed") {
    return (
      <article className={cn("group relative mb-6 break-inside-avoid select-none", base.className)}>
        <Link href={href} className="block transition-transform duration-200 hover:-translate-y-0.5">
          <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#f7f2ea_0%,#efe7dc_100%)]">
            {base.image ? (
              <img
                src={base.image}
                alt={base.title}
                className="block h-auto w-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="aspect-[4/5] w-full bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200" />
            )}
            {base.saveMeta && (
              <div className="absolute right-3 top-3 z-10">
                <SaveHeart
                  activityId={base.id}
                  activityTitle={base.title}
                  coverImageUrl={base.image}
                  eventPlanDateISO={base.saveMeta?.dateISO ?? null}
                  eventPlanDateEndISO={base.saveMeta?.dateEndISO ?? activityDateEnd}
                  source={base.saveMeta?.source}
                />
              </div>
            )}
            {base.priceText && (
              <span className="absolute bottom-3 right-3 inline-flex h-7 items-center rounded-full px-3 font-mono text-[11px] font-medium backdrop-blur-[4px] bg-[rgba(20,18,16,0.72)] text-white">
                {normalizeUiCurrencyText(base.priceText)}
              </span>
            )}
          </div>

          <div className="space-y-1 px-1.5 pb-1 pt-2.5">
            <H3
              as="span"
              className="block text-[13px] font-semibold leading-4.5 text-neutral-900 transition-colors duration-150 group-hover:text-primary line-clamp-2 md:text-[14px]"
            >
              {base.title}
            </H3>
            {base.meta && (
              <Caption className="block text-[11px] text-neutral-500 line-clamp-1 md:text-[12px]">
                {base.meta}
              </Caption>
            )}
          </div>
        </Link>
      </article>
    );
  }

  const categoryLabel =
    base.format === "ONLINE" ? getActivityFormatLabel(base.format) : undefined;

  return (
    <div className={cn("group relative select-none", base.className)}>
      <Link href={href} className="block focus:outline-none">
        {/* Image */}
        <div
          className="relative overflow-hidden rounded-[18px] bg-[#EDE8DF]"
          style={{ aspectRatio: coverRatio.replace(/\s/g, "") }}
        >
          {base.image ? (
            <img
              src={base.image}
              alt={base.title}
              className="h-full w-full object-cover transition-transform duration-[1000ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 9px, rgba(20,18,16,0.07) 9px, rgba(20,18,16,0.07) 10px)",
              }}
            >
              {categoryLabel && (
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[rgba(20,18,16,0.30)]">
                  {categoryLabel}
                </span>
              )}
            </div>
          )}

          {/* Price badge — bottom right */}
          {base.priceText && (
            <span className="absolute bottom-3 right-3 inline-flex h-7 items-center rounded-full px-3 font-mono text-[11px] font-medium backdrop-blur-[4px] bg-[rgba(20,18,16,0.72)] text-white">
              {normalizeUiCurrencyText(base.priceText)}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="mt-3 flex flex-col gap-1 px-0.5">
          {(base.badges[0] || categoryLabel) && (
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
              {[base.badges[0], categoryLabel].filter(Boolean).join(" · ")}
            </div>
          )}
          <div className="line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#141210] transition-colors duration-150 group-hover:text-[#C24E22]">
            {base.title}
          </div>
          {metaText && (
            <Caption className="mt-0.5 font-mono text-[12px] text-[rgba(20,18,16,0.55)] line-clamp-1">
              {metaText}
            </Caption>
          )}
        </div>
      </Link>

      {/* Heart outside <Link> to prevent bubbling */}
      {base.saveMeta && (
        <div className="absolute right-3 top-3 z-10">
          <SaveHeart
            activityId={base.id}
            activityTitle={base.title}
            coverImageUrl={base.image}
            eventPlanDateISO={base.saveMeta?.dateISO ?? null}
            eventPlanDateEndISO={base.saveMeta?.dateEndISO ?? activityDateEnd}
            source={base.saveMeta?.source}
            className="h-8 w-8 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px]"
            iconClassName="h-4 w-4"
          />
        </div>
      )}
    </div>
  );
}
