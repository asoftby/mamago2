"use client";

import { ChevronLeft, ChevronRight, Tag, Clock, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRef } from "react";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";

interface Offer {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  description?: string;
  price?: number;
  discount?: number;
  duration?: string;
  capacity?: number;
  category?: string;
}

interface PlaceOffersCarouselProps {
  offers: Offer[];
  placeId: string;
}

export function PlaceOffersCarousel({
  offers,
  placeId,
}: PlaceOffersCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!offers || offers.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Специальные предложения
          </h2>
          <p className="text-gray-600 mt-1">
            Выгодные пакеты и услуги от этого места
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll("left")}
            className="rounded-full"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll("right")}
            className="rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-4"
      >
        {offers.map((offer) => (
          <Link
            key={offer.id}
            href={`/offers/${offer.slug}`}
            className="flex-shrink-0 w-[300px] group"
          >
            <Card className="overflow-hidden border-gray-200 hover:shadow-lg transition-shadow">
              {/* Offer image */}
              <div className="relative h-48 bg-gray-100">
                {offer.imageUrl ? (
                  <Image
                    src={offer.imageUrl}
                    alt={offer.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized={isAppMediaUrl(offer.imageUrl)}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-pink-50">
                    <Tag className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                
                {/* Discount badge */}
                {offer.discount && offer.discount > 0 && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    -{offer.discount}%
                  </div>
                )}

                {offer.category && (
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-gray-700">
                    {offer.category}
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {offer.title}
                </h3>

                {offer.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {offer.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-gray-600">
                  {offer.duration && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{offer.duration}</span>
                    </div>
                  )}

                  {offer.capacity && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">до {offer.capacity} человек</span>
                    </div>
                  )}
                </div>

                {offer.price !== undefined && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {offer.discount && offer.discount > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {formatPrice(Math.round(offer.price * (1 - offer.discount / 100)), { hideZero: true })}
                        </span>
                        <span className="text-sm text-gray-500 line-through">
                          {formatPrice(offer.price, { hideZero: true })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-gray-900">
                        {offer.price === 0
                          ? "Бесплатно"
                          : formatPriceFrom(offer.price, { hideZero: true })}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {offers.length > 3 && (
        <div className="mt-6 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={`/places/${placeId}/offers`}>
              Посмотреть все предложения ({offers.length})
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
