"use client";

import Link from "next/link";
import { PublicCatalogCardCover, PublicCatalogCardDetails, PublicCatalogCardCategory } from "@/components/catalog/PublicCatalogCardCore";
import { cn } from "@/lib/utils";
import { SaveHeart } from "@/features/save/SaveHeart";
import type { HomePlanAttribution } from "@/features/save/planAttribution";
import { resolvePosterFrame } from "@/lib/media/posterFrame";

// ─── Public props ────────────────────────────────────────────────────────────

export type EventCardProps = {
  id: string;
  title: string;
  isPromoted?: boolean;
  href: string;
  imageUrl?: string | null;
  /** Keep genuinely above-the-fold covers eager and high priority. */
  imagePriority?: boolean;
  /** Моно-капсы под изображением: "СПЕКТАКЛИ", "СПЕКТАКЛИ · ОНЛАЙН" и т.д. */
  categoryLabel?: string;
  /** Строка мета: "12+ · 6–7 июн." */
  metaLabel?: string;
  /** Бейдж цены на обложке: "от 48 б", "бесплатно" */
  priceLabel?: string;
  /** Отношение сторон обложки, по умолчанию 4/5 (только для framing="fixed") */
  coverRatio?: string;
  /** Preserve the complete poster when a uniform carousel viewport is required. */
  coverFit?: "cover" | "contain";
  /** Stored pixel size of the cover (MediaAsset); null = unknown. */
  imageWidth?: number | null;
  imageHeight?: number | null;
  /**
   * "fixed" — legacy single frame `coverRatio` (carousels, journal embeds).
   * "poster" — native poster ratio with the 16:9…2:3 crop rule (listings).
   */
  framing?: "fixed" | "poster";
  /** Override `sizes` when the card is not in the carousel shell. */
  imageSizes?: string;
  saveMeta?: {
    dateISO?: string | null;
    dateEndISO?: string | null;
    source?: string;
    /** Preserve recommendation conversion attribution through shared EventCard. */
    planAttribution?: HomePlanAttribution;
  };
  className?: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function EventCard({
  id,
  title,
  href,
  imageUrl,
  imagePriority = false,
  categoryLabel,
  metaLabel,
  priceLabel,
  coverRatio = "4/5",
  coverFit = "cover",
  imageWidth,
  imageHeight,
  framing = "fixed",
  imageSizes,
  saveMeta,
  className,
}: EventCardProps) {
  const poster = framing === "poster" ? resolvePosterFrame(imageWidth, imageHeight) : null;
  const aspectRatio = poster ? poster.aspectRatio : coverRatio;
  // Fixed framing keeps the legacy default (center) without extra classes.
  const objectPositionClass = poster?.objectPosition === "top" ? "object-top" : undefined;
  return (
    <div className={cn("group relative select-none", className)}>
      <Link href={href} className="block focus:outline-none">
        <PublicCatalogCardCover
          imageUrl={imageUrl} title={title} aspectRatio={aspectRatio}
          imagePriority={imagePriority} coverFit={coverFit}
          imageSizes={imageSizes} objectPositionClass={objectPositionClass}
          posterCrop={poster ? (poster.cropped ? poster.objectPosition : "none") : undefined}
          placeholder={categoryLabel ? <PublicCatalogCardCategory label={categoryLabel} placeholder /> : null}
        />

        <PublicCatalogCardDetails title={title} label={metaLabel} priceLabel={priceLabel}
          category={categoryLabel ? <PublicCatalogCardCategory label={categoryLabel} /> : null} />
      </Link>

      {/* SaveHeart — outside Link to prevent navigation */}
      {saveMeta && (
        <SaveHeart
          activityId={id}
          activityTitle={title}
          coverImageUrl={imageUrl}
          ticket={{ priceLabel }}
          eventPlanDateISO={saveMeta.dateISO ?? null}
          eventPlanDateEndISO={saveMeta.dateEndISO ?? null}
          source={saveMeta.source}
          planAttribution={saveMeta.planAttribution}
          className="absolute right-3 top-3 h-11 w-11 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px] sm:h-8 sm:w-8"
          iconClassName="h-5 w-5 sm:h-4 sm:w-4"
        />
      )}
    </div>
  );
}
