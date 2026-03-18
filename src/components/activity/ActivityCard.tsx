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
import { formatRuShortDayMonth } from "@/lib/formatters/date";

type DomainActivity = {
  id: string;
  title: string;
  image: string;
  coverImage?: string | null;
  ageFrom?: number;
  dateStart?: string | null;
  workingHours?: string | null;
  priceMin?: number | null;
  currency?: string | null;
  badge?: string | null;
  rating?: number | null;
};

export type ActivitySaveMeta = {
  title: string;
  dateISO?: string | null;
  dateLabel?: string | null;
  timeSlots?: { id: string; label: string }[] | null;
  timeLabel?: string | null;
};

type AdapterProps =
  | { activity: DomainActivity; className?: string; saveMeta?: ActivitySaveMeta; onSaveResult?: (result: SaveToPlanResult) => void }
  | {
      id: string;
      title: string;
      image: string;
      age?: string;
      dateLabel?: string;
      priceLabel?: string;
      badge?: string;
      rating?: number;
      className?: string;
      saveMeta?: ActivitySaveMeta;
      onSaveResult?: (result: SaveToPlanResult) => void;
    };

export function ActivityCard(props: AdapterProps) {
  const params = useParams() as { city?: string };
  const city = params?.city || "minsk";

  const base =
    "activity" in props
      ? {
          id: props.activity.id,
          title: props.activity.title,
          image: props.activity.coverImage ?? props.activity.image ?? null,
          meta: [
            typeof props.activity.ageFrom === "number" ? `${props.activity.ageFrom}+` : null,
            props.activity.dateStart
              ? formatRuShortDayMonth(props.activity.dateStart)
              : props.activity.workingHours || null,
            props.activity.priceMin === 0
              ? "Бесплатно"
              : props.activity.priceMin
              ? `от ${props.activity.priceMin} ${props.activity.currency || ""}`.trim()
              : null,
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
          badges: (props.activity.badge ? [props.activity.badge] : []) as string[],
          rating: props.activity.rating ?? undefined,
          className: props.className,
          dateStart: props.activity.dateStart,
          saveMeta: props.saveMeta,
          onSaveResult: props.onSaveResult,
        }
      : {
          id: props.id,
          title: props.title,
          image: props.image,
          meta: [
            props.age || null,
            props.dateLabel || null,
            props.priceLabel || null,
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
          badges: props.badge ? [props.badge] : [],
          rating: props.rating,
          className: props.className,
          dateStart: null,
          saveMeta: props.saveMeta,
          onSaveResult: props.onSaveResult,
        };

  const href = `/${city}/activity/${base.id}`;

  const ratingStr =
    typeof base.rating === "number"
      ? base.rating.toFixed(1).replace(".", ",")
      : undefined;
  const metaText = [base.meta, ratingStr ? `★ ${ratingStr}` : null]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className={cn("group relative select-none", base.className)}>
      <Link href={href} className="block">
        <MediaCover imageUrl={base.image} ratio="4/5">
          {base.badges?.length > 0 && (
            <div className="absolute top-3 left-3 z-10 flex gap-2">
              {base.badges.slice(0, 2).map((b, i) => (
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
