"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Heart, MapPin } from "lucide-react";
import type { PublicationPriceMode } from "@prisma/client";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import { renderPriceWithIcon } from "@/components/icons/BelarusianRubleIcon";

export type PlaceCardVariant = "default" | "compact" | "network";

export type PlaceCardProps = {
  id: string;
  slug: string;
  title: string;
  coverImage?: string | null;
  // Address components for 2-line display
  cityAddress?: string; // Line 1: "Минск, ул. Ратомская, 7"
  district?: string; // Line 2 part 1: "Центральный район" (optional, for backward compatibility)
  metro?: string; // Line 2: "м. Немига"
  tags?: string[]; // e.g., ["1+", "Кафе", "Indoor"]
  variant?: PlaceCardVariant;
  isSaved?: boolean;
  onSaveToggle?: (placeId: string) => void;
  className?: string;
  /**
   * The Place's own city slug — when provided, links to the city-scoped
   * canonical (`/{citySlug}/places/{slug}`). Optional so existing callers
   * without city data in scope keep compiling; they get the legacy
   * `/places/{slug}` path, which still 301-redirects to the canonical
   * (see `src/app/(public)/places/[slug]/page.tsx`), never a dead link.
   * New callers with city data available should pass it — see
   * BACKLOG-118.
   */
  citySlug?: string;
  priceMode?: PublicationPriceMode | null;
  priceFrom?: number | null;
  priceTo?: number | null;
  currency?: string | null;
};

export function PlaceCard({
  id,
  slug,
  title,
  coverImage,
  cityAddress,
  district,
  metro,
  tags = [],
  variant = "default",
  isSaved = false,
  onSaveToggle,
  className,
  citySlug,
  priceMode,
  priceFrom,
  priceTo,
  currency,
}: PlaceCardProps) {
  const priceLabel = formatPublicCardPrice({ priceMode, priceFrom, priceTo, currency });
  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSaveToggle?.(id);
  };

  // For network variant: only show metro on line 2 (no district)
  // For other variants: show district • metro (backward compatibility)
  const line2 = variant === "network" 
    ? metro 
    : (() => {
        const parts: string[] = [];
        if (district) parts.push(district);
        if (metro) parts.push(metro);
        return parts.join(" • ");
      })();

  const hasLocation = cityAddress || line2;

  const cardContent = (
    <>
      {/* Cover Image */}
      <div className="relative">
        <div
          className={cn(
            "relative overflow-hidden bg-muted",
            variant === "network" && "aspect-[4/3] rounded-t-lg",
            variant === "compact" && "aspect-[16/9] rounded-t-lg",
            variant === "default" && "aspect-[16/9] rounded-t-lg"
          )}
        >
          {coverImage ? (
            <img
              src={coverImage}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <MapPin className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveClick}
          className={cn(
            "absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-105 active:scale-95",
            isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all duration-300",
              isSaved && "fill-current"
            )}
          />
        </button>
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex flex-col",
          variant === "network" && "p-4 space-y-2",
          variant === "compact" && "p-3 space-y-2",
          variant === "default" && "p-4 space-y-2"
        )}
      >
        {/* Tags/Chips - positioned above title */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className={cn(
                  "inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary",
                  variant === "network" && "text-xs px-2.5 py-0.5"
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {priceLabel && (
          <div className="text-sm font-semibold text-foreground">{renderPriceWithIcon(priceLabel)}</div>
        )}

        {/* Title */}
        <h3
          className={cn(
            "font-semibold text-foreground line-clamp-2 transition-colors group-hover:text-primary",
            variant === "network" && "text-base leading-snug",
            variant === "compact" && "text-base",
            variant === "default" && "text-lg"
          )}
        >
          {title}
        </h3>

        {/* Location - 2 lines with smaller font */}
        {hasLocation && (
          <div className="flex flex-col gap-0.5">
            {/* Line 1: City + Address */}
            {cityAddress && (
              <div className="flex items-start gap-1 text-muted-foreground">
                <MapPin className={cn(
                  "flex-shrink-0 mt-0.5",
                  variant === "network" && "h-3.5 w-3.5",
                  variant !== "network" && "h-3.5 w-3.5"
                )} />
                <span
                  className={cn(
                    "leading-snug",
                    variant === "network" && "text-xs",
                    variant !== "network" && "text-sm"
                  )}
                >
                  {cityAddress}
                </span>
              </div>
            )}
            
            {/* Line 2: Metro (network) or District • Metro (other variants) */}
            {line2 && (
              <div
                className={cn(
                  "text-muted-foreground leading-snug",
                  variant === "network" && "text-xs pl-[18px]",
                  variant !== "network" && "text-sm",
                  variant !== "network" && cityAddress && "pl-[18px]"
                )}
              >
                {line2}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <Link
      href={citySlug ? `/${citySlug}/places/${slug}` : `/places/${slug}`}
      className={cn(
        "group block overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:shadow-md",
        variant === "network" && "w-full",
        variant === "compact" && "w-full",
        variant === "default" && "w-full",
        className
      )}
    >
      {cardContent}
    </Link>
  );
}
