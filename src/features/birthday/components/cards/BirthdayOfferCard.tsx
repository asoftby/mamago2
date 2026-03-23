"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import type { BirthdayOffer } from "../../types/birthday";
import { cn } from "@/lib/utils";
import { OfferRecommendationBlock } from "../OfferRecommendationBlock";

export type OfferCardRecommendation = {
  first: string;
  second?: string;
};

interface BirthdayOfferCardProps {
  offer: BirthdayOffer;
  compact?: boolean;
  /** Use larger image in compact mode for single-column layout */
  wide?: boolean;
  onRequest?: (offer: BirthdayOffer) => void;
  /** Скрыть «Оставить заявку» (например, на шаге итога — заявка через bottom bar) */
  hideRequestCta?: boolean;
  /** Персональная рекомендация (2 коротких предложения); при наличии скрывает длинное описание и бейдж «Топ» */
  recommendation?: OfferCardRecommendation | null;
}

export function BirthdayOfferCard({
  offer,
  compact = false,
  wide = false,
  onRequest,
  hideRequestCta = false,
  recommendation = null,
}: BirthdayOfferCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden",
      "hover:shadow-md transition-shadow duration-200",
      compact ? "flex flex-row" : "flex flex-col"
    )}>
      {/* Image */}
      <div className={cn(
        "relative shrink-0 bg-muted overflow-hidden",
        compact
          ? wide
            ? "w-32 h-32 sm:w-40 sm:h-40"
            : "w-24 h-24 sm:w-28 sm:h-28"
          : "w-full h-44"
      )}>
        <Image
          src={offer.image}
          alt={offer.title}
          fill
          className="object-cover"
          sizes={compact ? (wide ? "160px" : "112px") : "(max-width: 640px) 100vw, 400px"}
        />
        {offer.isFeatured && !recommendation && (
          <span className="absolute top-2 left-2 bg-[#EF8759] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Топ
          </span>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1.5 p-3", compact ? "flex-1 min-w-0" : "p-4")}>
        {offer.businessName && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {offer.businessName}
          </span>
        )}

        <h3 className={cn(
          "font-semibold leading-snug text-foreground line-clamp-2",
          compact ? "text-sm" : "text-[0.9375rem]"
        )}>
          {offer.title}
        </h3>

        {recommendation && (
          <OfferRecommendationBlock
            first={recommendation.first}
            second={recommendation.second}
          />
        )}

        {!recommendation && !compact && offer.shortDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {offer.shortDescription}
          </p>
        )}

        <div className="flex items-center gap-3 mt-auto pt-1">
          {/* Price */}
          {offer.priceFrom && (
            <span className="text-sm font-semibold text-foreground">
              от {offer.priceFrom} {offer.currency}
            </span>
          )}

          {/* Rating */}
          {offer.rating && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {offer.rating}
              {offer.reviewCount && (
                <span className="opacity-60">({offer.reviewCount})</span>
              )}
            </span>
          )}
        </div>

        {!compact && (
          <div className={cn("flex gap-2 mt-2", hideRequestCta && "justify-stretch")}>
            {!hideRequestCta && (
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#EF8759] text-white text-sm font-medium py-2 hover:bg-[#e07848] transition-colors"
                onClick={() => onRequest?.(offer)}
              >
                Оставить заявку
              </button>
            )}
            <button
              type="button"
              className={cn(
                "rounded-xl border border-border text-sm font-medium px-3 py-2 hover:bg-muted/50 transition-colors",
                hideRequestCta && "w-full flex-1"
              )}
            >
              Подробнее
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
