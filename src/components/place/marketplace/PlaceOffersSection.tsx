"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { OfferCard } from "@/components/offers/OfferCard";

interface Offer {
  id: string;
  title: string;
  slug: string;
  kind: string;
  campProgramType?: string | null;
  durationType?: string | null;
  imageUrl?: string;
  description?: string;
  price?: number;
  category?: string;
  duration?: string;
}

interface PlaceOffersSectionProps {
  offers: Offer[];
  placeId: string;
  citySlug?: string;
}

export function PlaceOffersSection({ offers, placeId, citySlug = "minsk" }: PlaceOffersSectionProps) {
  if (offers.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[#141210]">
          Предложения
        </h2>
        <Link
          href={`/places/${placeId}#offers`}
          className="flex items-center gap-1 text-[14px] text-[rgba(20,18,16,0.55)] transition hover:text-[#141210]"
        >
          Все <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            id={offer.id}
            title={offer.title}
            href={getOfferPublicPath(offer, citySlug)}
            imageUrl={offer.imageUrl}
            categoryLabel={offer.category ?? offer.kind}
            priceLabel={offer.price ? `от ${offer.price} BYN` : undefined}
          />
        ))}
      </div>
    </section>
  );
}
