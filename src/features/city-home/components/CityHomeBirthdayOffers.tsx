"use client";

import { Fragment, useMemo } from "react";
import { useCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { rankHomeByAudience, homeAudienceSections } from "@/features/city-home/lib/rankHomeByAudience";
import { HomeSectionQuickChips } from "@/features/city-home/components/HomeSectionQuickChips";
import { selectHomeBirthdayOffers } from "@/features/city-home/lib/homeBirthdayPreview";
import { OfferCard } from "@/components/offers/OfferCard";
import { EVENT_CARD_SHELL } from "@/components/events";
import { CityHomeSection } from "./CityHomeSection";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { CityHomeAllLink, HomeCarouselHeading } from "./SectionHeader";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import { formatCardAge } from "@/lib/discovery/formatCardAge";
import type { BirthdayCatalogItem, PartyCategoryKey } from "@/features/birthday/builder/lib/realCatalog";

const CATEGORY_LABELS: Record<PartyCategoryKey, string> = {
  VENUE: "Площадка", ANIMATOR: "Аниматор", SHOW: "Шоу",
  MASTER_CLASS: "Мастер-класс", CAKE: "Торт", FOOD: "Еда",
  DECOR: "Декор", PHOTO: "Фото и видео", PROGRAM: "Программа", OTHER: "Другое",
};

export function CityHomeBirthdayOffers({ offers }: { offers: BirthdayCatalogItem[] }) {
  const { citySlug, appendCityQuery } = useCity();
  const family = useFamilyPersona();
  const { applied } = useDiscoveryFilters();
  const sections = useMemo(() => {
    const audience = {
      personas: family?.personas ?? [],
      selectedPersonaIds: family?.selectedPersonaIds ?? [],
      manualAgeRanges: applied.age,
    };
    const age = (offer: BirthdayCatalogItem) => ({
      ageFrom: offer.ageMinMonths == null ? null : offer.ageMinMonths / 12,
      ageTo: offer.ageMaxMonths == null ? null : offer.ageMaxMonths / 12,
      agePolicy: offer.ageMinMonths == null && offer.ageMaxMonths == null ? "UNKNOWN" : null,
    });
    const eligibleFirst = rankHomeByAudience(offers, audience, age);
    return homeAudienceSections(selectHomeBirthdayOffers(eligibleFirst), audience, age);
  }, [offers, family?.personas, family?.selectedPersonaIds, applied.age]);
  const preview = [...sections.primary, ...sections.alternatives];
  if (offers.length === 0 || preview.length === 0) return null;
  const categories = [...new Set(offers.flatMap(offer => offer.category ? [offer.category] : []))];

  return (
    <CityHomeSection title="Предложения для праздника" hideHeader>
      <HorizontalCardRow
        headerTitle={<HomeCarouselHeading title="Предложения для праздника" />}
        navLeading={<CityHomeAllLink href={appendCityQuery(`/${citySlug}/birthday`)} label="[все предложения]" />}
        underHeader={<HomeSectionQuickChips label="Категории праздника" chips={categories.map(category => ({
          label: CATEGORY_LABELS[category],
          href: `/${citySlug}/birthday?category=${category}`,
        }))} />}
      >
        {preview.map((offer) => (
          <Fragment key={offer.id}>
          <div className={EVENT_CARD_SHELL}>
            <OfferCard
              id={offer.id}
              title={offer.title}
              href={getOfferPublicPath({ slug: offer.slug ?? offer.id }, citySlug)}
              imageUrl={offer.coverImage ?? undefined}
              categoryLabel={offer.productType === "PARTY_PACKAGE" ? "Праздник под ключ" : offer.category ? CATEGORY_LABELS[offer.category] : "Для праздника"}
              dateLabel={formatCardAge(offer.ageMinMonths != null ? Math.floor(offer.ageMinMonths / 12) : null, offer.ageMaxMonths != null ? Math.ceil(offer.ageMaxMonths / 12) : null)}
              priceLabel={formatPublicCardPrice({ priceMode: offer.priceMode as Parameters<typeof formatPublicCardPrice>[0]["priceMode"], priceFrom: offer.priceFrom, priceTo: null, currency: offer.currency }) ?? undefined}
              hideSave
            />
          </div>
          </Fragment>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}
