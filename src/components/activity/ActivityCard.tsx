"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/components/ui/media-cover";
import { H3, Caption } from "@/components/ui/typography";
import { SaveHeart } from "@/features/save/SaveHeart";
import { SaveToPlanResult } from "./SaveToPlanModal";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";

type DomainActivity = {
  id: string;
  /** Публичный slug события; если нет — в ссылке используется id */
  slug?: string | null;
  /** Канонический city slug для публичной страницы события. */
  citySlug?: string | null;
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
  if (a.priceMin === 0) return "Бесплатно";
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
  dateLabel?: string | null;
  timeSlots?: { id: string; label: string }[] | null;
  timeLabel?: string | null;
};

type AdapterProps =
  | {
      activity: DomainActivity;
      className?: string;
      /** Соотношение сторон обложки (`MediaCover`), по умолчанию `4/5` */
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

  const base =
    "activity" in props
      ? {
          id: props.activity.id,
          slug: props.activity.slug,
          citySlug: props.activity.citySlug,
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
            discoveryCardPriceCaption(props.activity),
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
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
          title: props.title,
          image: props.image,
          meta: [
            props.age || null,
            props.dateLabel || null,
            props.priceLabel || null,
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
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

  const href = publicActivityPath(base.id, base.citySlug ?? city, base.slug);

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
    .join(" • ");

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
                />
              </div>
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

  return (
    <div className={cn("group relative select-none", base.className)}>
      <Link href={href} className="block">
        <MediaCover imageUrl={base.image} ratio={coverRatio}>
        </MediaCover>

        <div className="mt-2.5 px-1">
          <H3
            as="span"
            className="text-sm md:text-base transition-colors duration-150 group-hover:text-primary line-clamp-2"
          >
            {base.title}
          </H3>
          {metaText && (
            <Caption className="text-muted-foreground line-clamp-1">
              {metaText}
            </Caption>
          )}
        </div>
      </Link>

      {/* SaveHeart is outside <Link> to prevent click bubbling into navigation */}
      {base.saveMeta && (
        <div className="absolute top-3 right-3 z-10">
          <SaveHeart
            activityId={base.id}
            activityTitle={base.title}
            coverImageUrl={base.image}
          />
        </div>
      )}
    </div>
  );
}
