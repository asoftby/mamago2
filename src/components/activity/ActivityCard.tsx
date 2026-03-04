"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/components/ui/media-cover";
import { Badge } from "@/components/ui/badge";
import { H3, Caption } from "@/components/ui/typography";
import { Heart } from "lucide-react";
import { SaveToPlanModal, SaveScenario, SaveToPlanResult } from "./SaveToPlanModal";
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
  const [modalOpen, setModalOpen] = React.useState(false);
  const [scenario, setScenario] = React.useState<SaveScenario | null>(null);

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

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!base.saveMeta) return;

    // Build scenario based on saveMeta
    const { title, dateISO, dateLabel, timeSlots, timeLabel } = base.saveMeta;

    if (dateISO && dateLabel) {
      const slotsCount = timeSlots?.length ?? 0;
      
      if (slotsCount === 0 && timeLabel) {
        // Case A: Single date + single time
        setScenario({
          kind: "confirm",
          title,
          dateLabel,
          timeLabel,
          dateISO,
          slotId: null,
        });
      } else if (slotsCount === 1 && timeSlots) {
        // Case A: Single date + single slot
        setScenario({
          kind: "confirm",
          title,
          dateLabel,
          timeLabel: timeSlots[0].label,
          dateISO,
          slotId: timeSlots[0].id,
        });
      } else if (slotsCount > 1 && timeSlots) {
        // Case B: Multiple time slots
        setScenario({
          kind: "timeslots",
          title,
          dateLabel,
          dateISO,
          slots: timeSlots,
        });
      } else {
        // Case C: Date but no time info
        setScenario({
          kind: "quickdate",
          title,
        });
      }
    } else {
      // Case C: No date/time
      setScenario({
        kind: "quickdate",
        title,
      });
    }

    setModalOpen(true);
  };

  const handleModalConfirm = (result: SaveToPlanResult) => {
    base.onSaveResult?.(result);
  };

  return (
    <>
      <Link href={href} className={cn("group block select-none", base.className)}>
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
          {base.saveMeta && (
            <button
              onClick={handleHeartClick}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-border/20 flex items-center justify-center hover:bg-white transition-colors"
              aria-label="Сохранить"
            >
              <Heart className="w-5 h-5 text-foreground" />
            </button>
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

      {scenario && (
        <SaveToPlanModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          scenario={scenario}
          onConfirm={handleModalConfirm}
        />
      )}
    </>
  );
}
