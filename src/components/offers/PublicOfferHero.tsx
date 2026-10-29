import { BookingCountdown, pluralReviews } from "./OfferHero";
import type { ReactNode, RefObject } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { PublicationHeroLayout } from "@/components/publication-page/PublicationHeroLayout";
import {
  PUBLICATION_PRIMARY_ACTION_CLASS,
  PUBLICATION_BADGE_CLASS,
} from "@/components/publication-page/publicationStyles";
import { PublicationTitle } from "@/components/publication-page/PublicationTitle";
import { PublicationMediaColumn } from "@/components/media/PublicationMediaColumn";
import { mapOfferPageMedia } from "@/lib/media/mapOfferPageMedia";
import {
  SidebarCard,
  SidebarCardShare,
  SidebarCardTopSection,
} from "@/components/shared/SidebarCard";
import { PlaceInfoRow } from "@/components/shared/PlaceInfoRow";
import { Button } from "@/components/ui/button";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { cn } from "@/lib/utils";

export interface PublicOfferHeroProps {
  data: OfferPageData;
  priceLabel: string;
  sessionLine?: string;
  isPrimaryLoading?: boolean;
  isSaved: boolean;
  canEditOffer: boolean;
  ctaRef: RefObject<HTMLElement | null>;
  directSlot?: ReactNode;
  ownerEditSlot?: ReactNode;
  onPrimary: () => void;
  onSave: () => void;
}

const PRODUCT_LABELS: Record<string, string> = {
  PLACE_VISIT: "Предложение",
  ONE_TIME_ACTIVITY: "Занятие",
  REGULAR_ACTIVITY: "Занятия",
  CAMP: "Лагерь",
  PARTY_SERVICE: "Услуга",
  PARTY_PACKAGE: "Праздник под ключ",
};

/** Presentation only: every action is supplied by the existing OfferPageView controller. */
export function PublicOfferHero({
  data,
  priceLabel,
  sessionLine,
  isPrimaryLoading,
  isSaved,
  ctaRef,
  directSlot,
  ownerEditSlot,
  onPrimary,
  onSave,
}: PublicOfferHeroProps) {
  const media = mapOfferPageMedia(data.media, data.title);
  const label =
    PRODUCT_LABELS[data.productType ?? ""] ??
    (data.offerType === "CAMP"
      ? "Лагерь"
      : data.offerType === "REGULAR"
        ? "Занятия"
        : "Предложение");
  const age = data.metaGrid.find((fact) =>
    /age|возраст/i.test(`${fact.id} ${fact.label}`),
  );
  return (
    <PublicationHeroLayout
      media={
        <PublicationMediaColumn
          media={media.media}
          galleryItems={media.galleryItems}
        />
      }
      decision={
        <div className="flex min-w-0 flex-col gap-5 break-words">
          <nav
            aria-label="Breadcrumb"
            className="hidden flex-wrap items-center gap-1.5 text-[13px] text-text-muted lg:flex"
          >
            <Link href="/">Главная</Link>
            <span aria-hidden="true">›</span>
            <Link href={`/${data.citySlug}/offers`}>{label}</Link>
            <span aria-hidden="true">›</span>
            <span>{data.title}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={PUBLICATION_BADGE_CLASS}>{label}</span>
            {age && (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {age.value}
              </span>
            )}
          </div>
          <PublicationTitle>{data.title}</PublicationTitle>
          {data.shortDescription?.trim() && (
            <p className="text-base leading-relaxed text-text-muted">
              {data.shortDescription}
            </p>
          )}
          <div ref={ctaRef as RefObject<HTMLDivElement | null>}>
            <SidebarCard sticky className="lg:sticky lg:top-6">
              {(sessionLine || priceLabel) && (
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                  {sessionLine && (
                    <div>
                      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        {data.schedule?.type === "shifts"
                          ? "Ближайшая смена"
                          : "Расписание"}
                      </p>
                      <p className="text-xl font-semibold">{sessionLine}</p>
                    </div>
                  )}
                  {priceLabel && (
                    <div>
                      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        Стоимость
                      </p>
                      <p className="font-pt-serif text-[40px] leading-tight tracking-[-1px] text-text-main">
                        {renderCurrencyText(priceLabel, { iconSize: "sm" })}
                      </p>
                      {data.pricing.oldPrice && (
                        <p className="text-sm text-text-muted line-through">
                          {renderCurrencyText(data.pricing.oldPrice, {
                            iconSize: "sm",
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {data.place && (
                <div className="mb-5">
                  <PlaceInfoRow
                    name={data.place.name}
                    logoUrl={data.place.logoUrl}
                    address={data.place.address}
                    district={data.place.district}
                    metro={data.place.metro}
                    href={
                      data.place.slug
                        ? `/${data.citySlug}/places/${data.place.slug}`
                        : undefined
                    }
                  />
                </div>
              )}
              {data.pricing.promotionText && (
                <p className="mb-5 text-sm font-semibold text-brand">
                  {data.pricing.promotionText}
                </p>
              )}
              {data.pricing.promoUntil && (
                <BookingCountdown until={data.pricing.promoUntil} />
              )}
              <div className="flex items-center gap-3">
                {data.hasPrimaryAction !== false && (
                  <Button
                    type="button"
                    onClick={onPrimary}
                    disabled={isPrimaryLoading}
                    className={cn(
                      PUBLICATION_PRIMARY_ACTION_CLASS,
                      "min-w-0 whitespace-normal",
                    )}
                  >
                    {isPrimaryLoading ? "Загрузка..." : data.cta.primaryLabel}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSave}
                  aria-label={isSaved ? "Сохранено" : "Сохранить"}
                  aria-pressed={isSaved}
                  className={cn(
                    "h-14 w-14 shrink-0 rounded-full bg-transparent",
                    isSaved && "border-brand text-brand",
                  )}
                >
                  <Heart className={cn("h-5 w-5", isSaved && "fill-current")} />
                </Button>
              </div>
              {directSlot && <div className="mt-3">{directSlot}</div>}
              {ownerEditSlot && (
                <SidebarCardTopSection>{ownerEditSlot}</SidebarCardTopSection>
              )}
              <SidebarCardTopSection>
                <div className="flex items-center justify-between gap-3">
                  {data.averageRating != null ? (
                    <a href="#reviews" className="text-sm text-text-muted">
                      ★ {data.averageRating.toFixed(1)}
                      {data.reviewsCount
                        ? ` · ${pluralReviews(data.reviewsCount)}`
                        : ""}
                    </a>
                  ) : (
                    <span />
                  )}
                  <SidebarCardShare
                    title={data.title}
                    entityNoun="предложением"
                  />
                </div>
              </SidebarCardTopSection>
            </SidebarCard>
          </div>
        </div>
      }
    />
  );
}
