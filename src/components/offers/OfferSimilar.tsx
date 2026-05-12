"use client";

import Image from "next/image";
import { Star, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferSimilarItem } from "@/lib/offer/offerPageTypes";

interface OfferSimilarProps {
  items: OfferSimilarItem[];
}

/**
 * Similar Offers Section
 * Использует unified ActivityCard system
 * Horizontal scroll на мобильном, grid на десктопе
 */
export function OfferSimilar({ items }: OfferSimilarProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] lg:text-[28px] font-bold text-foreground">
          Похожие предложения
        </h2>
        <a
          href="/offers"
          className="text-[15px] font-bold text-[#EF8759] hover:underline transition-all"
        >
          Смотреть все →
        </a>
      </div>

      {/* Desktop: Grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {items.map((item) => (
          <SimilarCard key={item.id} item={item} />
        ))}
      </div>

      {/* Mobile: Horizontal Scroll */}
      <div className="flex gap-6 overflow-x-auto px-4 -mx-4 pb-4 sm:hidden snap-x snap-mandatory scrollbar-hide">
        {items.map((item) => (
          <div key={item.id} className="snap-start shrink-0 w-[280px]">
            <SimilarCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

interface SimilarCardProps {
  item: OfferSimilarItem;
}

function SimilarCard({ item }: SimilarCardProps) {
  return (
    <a
      href={`/offers/${item.slug}`}
      className="group flex flex-col gap-4 rounded-[32px] border border-border/40 bg-white p-4 shadow-sm hover:shadow-xl hover:border-border/60 transition-all duration-500"
    >
      {/* Cover Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] bg-neutral-100">
        <Image
          src={item.coverUrl}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          sizes="(max-width: 640px) 280px, (max-width: 1024px) 33vw, 25vw"
        />
        
        {/* Price Badge Overlay */}
        {item.priceLabel && (
          <div className="absolute bottom-3 right-3 rounded-xl bg-white/90 px-3 py-1.5 text-[13px] font-bold text-foreground shadow-sm backdrop-blur-sm">
            {item.priceLabel}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 px-1 pb-2">
        {/* Title */}
        <h3 className="text-[17px] font-bold text-foreground leading-tight line-clamp-2 group-hover:text-[#EF8759] transition-colors">
          {item.title}
        </h3>

        {/* Meta Info */}
        <div className="flex flex-col gap-2">
          {item.placeTitle && (
            <div className="flex items-center gap-2 text-[14px] font-medium text-muted-foreground truncate">
              <MapPin className="h-4 w-4 shrink-0 text-[#EF8759]/60" />
              <span className="truncate">{item.placeTitle}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {item.ageLabel && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[12px] font-bold text-muted-foreground">
                {item.ageLabel}
              </span>
            )}
            {item.rating && (
              <div className="flex items-center gap-1 rounded-full bg-[#FFF7F3] px-2.5 py-1 text-[12px] font-bold text-[#EF8759]">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>{item.rating}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
