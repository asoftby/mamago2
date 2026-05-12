"use client";

import { MapPin, Navigation } from "lucide-react";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

interface OfferLocationProps {
  place: NonNullable<OfferPageData["place"]>;
}

/**
 * Location Block
 * Показывает: карту, адрес, метро, район, маршрут
 * Стиль как PlacePage
 */
export function OfferLocation({ place }: OfferLocationProps) {
  const hasCoordinates = place.lat && place.lng;

  return (
    <div className="space-y-4">
      <h3 className="text-[18px] lg:text-[20px] font-bold text-foreground">Где проходит</h3>

      <div className="overflow-hidden rounded-[24px] border border-border/40 bg-white shadow-sm">
        {/* Map Preview */}
        {hasCoordinates && (
          <div className="relative aspect-[16/9] w-full bg-neutral-100">
            {/* Map placeholder with gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFF7F3] to-[#F9FAFB] flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md">
                  <MapPin className="h-6 w-6 text-[#EF8759]" />
                </div>
              </div>
            </div>
            
            {/* Route Button Overlay */}
            <div className="absolute bottom-3 right-3">
              <a
                href={`https://yandex.ru/maps/?pt=${place.lng},${place.lat}&z=16&l=map`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-foreground shadow-md hover:bg-neutral-50 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5 text-[#EF8759]" />
                Маршрут
              </a>
            </div>
          </div>
        )}

        {/* Place Info */}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF7F3] text-[#EF8759]">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <a
                href={`/places/${place.slug}`}
                className="text-[15px] font-bold text-foreground hover:text-[#EF8759] transition-colors line-clamp-1"
              >
                {place.name}
              </a>
              {place.address && (
                <p className="mt-0.5 text-[13px] font-medium text-muted-foreground line-clamp-2">
                  {place.address}
                </p>
              )}
            </div>
          </div>

          {/* Tags / Badges */}
          {(place.district || place.metro) && (
            <div className="flex flex-wrap items-center gap-2">
              {place.district && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {place.district}
                </span>
              )}
              {place.metro && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  🚇 {place.metro}
                </span>
              )}
            </div>
          )}
          
          <div className="pt-1">
            <a 
              href={`/places/${place.slug}`}
              className="text-[13px] font-bold text-[#EF8759] hover:underline"
            >
              Подробнее о месте →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
