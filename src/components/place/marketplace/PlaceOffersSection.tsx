"use client";

import { ArrowRight, Heart, Calendar } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";

interface Offer {
  id: string;
  title: string;
  slug: string;
  kind: string;
  campProgramType?: string | null;
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
  if (offers.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Предложения (курсы и программы)
        </h2>
        <Link
          href={`/places/${placeId}#offers`}
          className="flex items-center gap-1 text-sm font-medium text-[#EF8759] transition hover:text-[#EF8759]/80"
        >
          Все предложения
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} citySlug={citySlug} />
        ))}
      </div>
    </section>
  );
}

function OfferCard({ offer, citySlug }: { offer: Offer; citySlug: string }) {
  return (
    <Link
      href={getOfferPublicPath(offer as any, citySlug)}
      className="group relative flex w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {offer.imageUrl ? (
          <Image
            src={offer.imageUrl}
            alt={offer.title}
            fill
            sizes="280px"
            unoptimized={isAppMediaUrl(offer.imageUrl)}
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Calendar className="h-12 w-12 text-gray-400" />
          </div>
        )}

        {/* Price Badge */}
        {offer.price && (
          <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900 shadow-md">
            от {offer.price} BYN
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            // TODO: Implement save functionality
          }}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 backdrop-blur-sm transition hover:bg-white"
          aria-label="Сохранить"
        >
          <Heart className="h-4 w-4 text-gray-700" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-gray-900 group-hover:text-[#EF8759]">
          {offer.title}
        </h3>

        {offer.description && (
          <p className="line-clamp-2 text-sm text-gray-600">
            {offer.description}
          </p>
        )}

        {offer.duration && (
          <div className="mt-auto text-sm text-gray-600">
            {offer.duration}
          </div>
        )}

        {offer.category && (
          <div className="mt-2">
            <span className="inline-block rounded-full bg-[#EF8759]/10 px-3 py-1 text-xs font-medium text-[#EF8759]">
              {offer.category}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
