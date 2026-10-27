"use client";

import Link from "next/link";
import { CalendarDays, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicationMediaColumn } from "@/components/media/PublicationMediaColumn";
import { mapOfferPageMedia } from "@/lib/media/mapOfferPageMedia";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { OwnerOfferEditDropdown } from "./OwnerOfferEditDropdown";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

type Props = {
  data: OfferPageData;
  canEditOffer?: boolean;
  isPrimaryLoading?: boolean;
  isSaved?: boolean;
  onPrimary: () => void;
  onSave: () => void;
  ctaRef?: React.RefObject<HTMLElement | null>;
  directSlot?: React.ReactNode;
};

/** Regular classes use the same media/info skeleton as the event detail page.
 * Booking and schedule logic remain owned by OfferPageView.
 */
export function RegularClassHero({
  data, canEditOffer, isPrimaryLoading, isSaved, onPrimary, onSave, ctaRef, directSlot,
}: Props) {
  const publicationMedia = mapOfferPageMedia(data.media, data.title);
  const price = normalizeUiCurrencyText(
    data.pricing.priceMode === "FREE" ? "Бесплатно"
      : data.pricing.priceMode === "ON_REQUEST" ? "Цена по запросу"
      : data.pricing.priceDisplay
        ? [data.pricing.priceDisplay, data.pricing.priceUnit].filter(Boolean).join(" ")
        : data.pricing.singlePrice || data.pricing.priceFrom || "",
  );

  return (
    <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-12">
      <PublicationMediaColumn media={publicationMedia.media} galleryItems={publicationMedia.galleryItems} />
      <div className="flex min-w-0 flex-col gap-6">
        <nav aria-label="Breadcrumb" className="hidden flex-wrap items-center gap-2 text-sm text-muted-foreground lg:flex">
          <Link href={`/${data.citySlug}`}>Главная</Link>
          <span aria-hidden="true">›</span>
          <Link href={`/${data.citySlug}/offers`}>Занятия</Link>
        </nav>
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Занятия</span>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-foreground md:text-[40px]">{data.title}</h1>
          {data.shortDescription ? <p className="text-base leading-relaxed text-muted-foreground">{data.shortDescription}</p> : null}
        </div>
        {data.metaGrid.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 border-y border-border py-5 sm:grid-cols-3">
            {data.metaGrid.slice(0, 3).map((fact) => (
              <div key={fact.id} className="min-w-0">
                <p className="text-xs text-muted-foreground">{fact.label}</p>
                <p className="mt-1 text-sm font-medium">{fact.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {data.place ? (
          <Link href={`/${data.citySlug}/places/${data.place.slug}`} className="text-sm text-foreground hover:underline">
            {data.place.name}{data.place.address ? ` · ${data.place.address}` : ""}
          </Link>
        ) : null}
        <div className="space-y-4 rounded-2xl border border-border p-5">
          {price ? <p className="text-xl font-semibold">{price}</p> : <p className="text-sm text-muted-foreground">Стоимость уточняется</p>}
          <div ref={ctaRef as React.RefObject<HTMLDivElement>} className="flex items-center gap-3">
            {data.hasPrimaryAction !== false ? (
              <button type="button" disabled={isPrimaryLoading} onClick={onPrimary}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                <CalendarDays className="h-4 w-4" />
                {isPrimaryLoading ? "Загрузка..." : data.cta.primaryLabel}
              </button>
            ) : null}
            <button type="button" aria-label={isSaved ? "Сохранено" : "Сохранить"} onClick={onSave}
              className={cn("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border", isSaved && "text-primary")}>
              <Heart className={cn("h-5 w-5", isSaved && "fill-current")} />
            </button>
          </div>
          {directSlot}
        </div>
        {canEditOffer ? (
          <OwnerOfferEditDropdown offerId={data.id} offerType={data.offerType} productType={data.productType} />
        ) : null}
      </div>
    </section>
  );
}
