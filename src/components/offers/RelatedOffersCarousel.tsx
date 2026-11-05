"use client";

import { OfferCard } from "./OfferCard";
import { EVENT_CARD_SHELL } from "@/components/events/eventCardLayout";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { CityHomeAllLink } from "@/features/city-home/components/CityHomeAllLink";

export type RelatedOffer = {
  id: string;
  title: string;
  href: string;
  image: string | null;
  price: string | null;
};

/** Same carousel, poster sizing and offer cards as the city homepage classes row. */
export function RelatedOffersCarousel({ offers, citySlug }: {
  offers: RelatedOffer[];
  citySlug: string;
}) {
  if (!offers.length) return null;

  return (
    <section aria-labelledby="other-business-offers-title" className="min-w-0">
      <HorizontalCardRow
        headerTitle={
          <h2 id="other-business-offers-title" className="font-editorial text-2xl md:text-3xl">
            Другие наши предложения
          </h2>
        }
        navLeading={<CityHomeAllLink href={`/${citySlug}/classes`} label="[все занятия]" />}
      >
        {offers.map((item) => (
          <div key={item.id} className={EVENT_CARD_SHELL}>
            <OfferCard
              id={item.id}
              title={item.title}
              href={item.href}
              imageUrl={item.image}
              priceLabel={item.price ?? undefined}
            />
          </div>
        ))}
      </HorizontalCardRow>
    </section>
  );
}
