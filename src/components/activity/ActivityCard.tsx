"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/components/ui/media-cover";
import { Badge } from "@/components/ui/badge";
import { H3, Caption } from "@/components/ui/typography";
import { SaveHeart } from "@/features/save/SaveHeart";
import { SaveToPlanResult } from "./SaveToPlanModal";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { publicActivityPath } from "@/lib/business/eventPublicLink";

type DomainActivity = {
  id: string;
  /** Публичный slug события; если нет — в ссылке используется id */
  slug?: string | null;
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
      saveMeta?: ActivitySaveMeta;
      onSaveResult?: (result: SaveToPlanResult) => void;
    };

export function ActivityCard(props: AdapterProps) {
  const params = useParams() as { city?: string };
  const city = params?.city || "minsk";
  const coverRatio = props.coverRatio ?? "4/5";

  const base =
    "activity" in props
      ? {
          id: props.activity.id,
          slug: props.activity.slug,
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

  const href = publicActivityPath(base.id, city, base.slug);

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

  return (
    <div className={cn("group relative select-none", base.className)}>
      <Link href={href} className="block">
        <MediaCover imageUrl={base.image} ratio={coverRatio}>
          {(base.geoBadge ||
            base.ageHintBadge ||
            (base.badges?.length ?? 0) > 0) && (
            <div className="absolute top-3 left-3 z-10 flex max-w-[min(100%-5rem,15rem)] flex-col gap-1.5 items-start">
              {base.geoBadge && (
                <Badge
                  className="border border-neutral-200/90 bg-neutral-100/95 px-2.5 py-0.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur-sm"
                >
                  {base.geoBadge}
                </Badge>
              )}
              {base.ageHintBadge && (
                <Badge
                  className="border border-slate-200/90 bg-slate-50/95 px-2.5 py-0.5 text-xs font-medium text-slate-800 shadow-sm backdrop-blur-sm"
                >
                  {base.ageHintBadge}
                </Badge>
              )}
              {base.badges?.slice(0, base.geoBadge || base.ageHintBadge ? 1 : 2).map((b, i) => (
                <Badge
                  key={i}
                  className="bg-white/90 text-foreground shadow-sm border-none backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium"
                >
                  {b}
                </Badge>
              ))}
            </div>
          )}
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
