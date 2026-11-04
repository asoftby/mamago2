"use client";

import { useCity } from "@/contexts/CityContext";
import { OfferCard } from "@/components/offers/OfferCard";
import { EVENT_CARD_SHELL } from "@/components/events";
import { CityHomeSection } from "./CityHomeSection";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { CityHomeAllLink } from "./SectionHeader";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import type { BirthdayCatalogItem, PartyCategoryKey } from "@/features/birthday/builder/lib/realCatalog";

const CATEGORY_LABELS: Record<PartyCategoryKey, string> = {
  VENUE: "Площадка", ANIMATOR: "Аниматор", SHOW: "Шоу",
  MASTER_CLASS: "Мастер-класс", CAKE: "Торт", FOOD: "Еда",
  DECOR: "Декор", PHOTO: "Фото и видео", PROGRAM: "Программа", OTHER: "Другое",
};

export function CityHomeBirthdayOffers({ offers }: { offers: BirthdayCatalogItem[] }) {
  const { citySlug, appendCityQuery } = useCity();
  if (offers.length === 0) return null;

  return (
    <CityHomeSection title="Предложения для праздника" reserveCarouselControls>
      <HorizontalCardRow
        navLeading={<CityHomeAllLink href={appendCityQuery(`/${citySlug}/birthday`)} label="[все предложения]" />}
      >
        {offers.map(offer => (
          <div key={offer.id} className={EVENT_CARD_SHELL}>
            <OfferCard
              id={offer.id}
              title={offer.title}
              href={getOfferPublicPath({ slug: offer.slug ?? offer.id }, citySlug)}
              imageUrl={offer.coverImage}
              categoryLabel={offer.productType === "PARTY_PACKAGE" ? "Праздник под ключ" : offer.category ? CATEGORY_LABELS[offer.category] : "Для праздника"}
              dateLabel={offer.ageMinMonths != null ? `${Math.floor(offer.ageMinMonths / 12)}+` : undefined}
              priceLabel={formatPublicCardPrice({ priceMode: offer.priceMode as Parameters<typeof formatPublicCardPrice>[0]["priceMode"], priceFrom: offer.priceFrom, priceTo: null, currency: offer.currency })}
              hideSave
            />
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}
