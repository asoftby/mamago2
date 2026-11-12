"use client";

import Link from "next/link";
import { PublicCatalogCardCover, PublicCatalogCardDetails, PublicCatalogCardCategory } from "@/components/catalog/PublicCatalogCardCore";
import { cn } from "@/lib/utils";
import { SaveHeart } from "@/features/save/SaveHeart";

export type OfferCardProps = {
  id: string;
  title: string;
  isPromoted?: boolean;
  href: string;
  imageUrl?: string | null;
  /** Label shown below image in mono caps, e.g. "Лагерь", "Курс" */
  categoryLabel?: string;
  /** Short placeholder text shown centred in the stripe background */
  placeholderLabel?: string;
  /** Date shown below title next to age, e.g. "20 июл.–18 авг." */
  dateLabel?: string;
  /** Price badge on bottom-right of image, e.g. "от 650 BYN" */
  priceLabel?: string;
  /** Promo badge on top-right, e.g. "-10% до 31.05" */
  promoBadge?: string;
  /** ISO date for the save-to-plan modal */
  saveDateISO?: string | null;
  saveDateEndISO?: string | null;
  saveSource?: string;
  /** Hide the save heart button (e.g. on the ideas page) */
  hideSave?: boolean;
  imagePriority?: boolean;
  className?: string;
};

export function OfferCard({
  id,
  title,
  href,
  imageUrl,
  categoryLabel,
  placeholderLabel,
  dateLabel,
  priceLabel,
  promoBadge,
  saveDateISO,
  saveDateEndISO,
  saveSource,
  hideSave,
  imagePriority = false,
  className,
}: OfferCardProps) {
  return (
    <div className={cn("group relative flex flex-col gap-3", className)}>
      <Link href={href} className="block focus:outline-none">
        <PublicCatalogCardCover imageUrl={imageUrl} title={title} imagePriority={imagePriority}
          animateOnHover
          placeholder={(placeholderLabel ?? categoryLabel) ? <PublicCatalogCardCategory label={placeholderLabel ?? categoryLabel ?? ""} placeholder /> : null}>
          {promoBadge && <span className="absolute left-3 top-3 inline-flex h-7 max-w-[calc(100%-4.5rem)] items-center truncate rounded-full bg-[#E86A3A] px-3 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(232,106,58,0.35)] sm:max-w-[calc(100%-3.75rem)]">{promoBadge}</span>}
        </PublicCatalogCardCover>

        <PublicCatalogCardDetails title={title} label={dateLabel} priceLabel={priceLabel}
          category={categoryLabel ? <PublicCatalogCardCategory label={categoryLabel} /> : null} />
      </Link>

      {/* SaveHeart outside Link to prevent navigation */}
      {!hideSave && (
        <SaveHeart
          activityId={id}
          offerId={id}
          activityTitle={title}
          coverImageUrl={imageUrl}
          eventPlanDateISO={saveDateISO ?? null}
          eventPlanDateEndISO={saveDateEndISO ?? null}
          source={saveSource}
          className="pointer-events-auto absolute right-3 top-3 z-20 h-11 w-11 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px] sm:h-8 sm:w-8"
          iconClassName="h-5 w-5 sm:h-4 sm:w-4"
        />
      )}
    </div>
  );
}
