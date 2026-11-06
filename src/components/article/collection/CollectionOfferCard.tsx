"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { CollectionEventMediaGallery } from "./CollectionEventMediaGallery";
import { SaveHeart } from "@/features/save/SaveHeart";
import { CampShiftBookingOverlay } from "@/components/offers/CampShiftBookingOverlay";
import { cn } from "@/lib/utils";
import { PublicationIdentityBadges } from "@/components/shared/PublicationIdentityBadges";
import { PublicationActionButtons, PUBLICATION_SAVE_ACTION_CLASS } from "@/components/shared/PublicationActionButtons";
import { ShareModal } from "@/components/shared/ShareModal";
import { CollectionPublicationFrame } from "./CollectionPublicationFrame";
import { CollectionSchedulePrice } from "./CollectionSchedulePrice";
import type { ResolvedOfferEmbedCard } from "@/lib/article/articleMvpRenderData";
import { CollectionLeadSheet } from "./CollectionLeadSheet";
import { collectionPrimaryAction } from "@/lib/article/collectionCardCta";
import { LEAD_RETURN_PARAM } from "@/lib/article/collectionLeadForm";
import { CollectionNote, CollectionRating, CollectionVenueQuote } from "./CollectionCardParts";

/** Карточка предложения внутри подборки: одинаково устроена для платных и бесплатных участников. */
export function CollectionOfferCard({ card }: { card: ResolvedOfferEmbedCard }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const action = collectionPrimaryAction(card);
  const hasLead = action === "lead";

  // Возврат после входа: ?leadOffer=<id> открывает лист с сохранённой формой.
  useEffect(() => {
    if (!hasLead) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(LEAD_RETURN_PARAM) !== card.offerId) return;
    url.searchParams.delete(LEAD_RETURN_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    rootRef.current?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- одноразовое открытие по маркеру возврата
    setLeadOpen(true);
  }, [hasLead, card.offerId]);
  const phone = card.ctaPhone ?? null;
  // `!`: стили ссылок статьи (text-primary, underline) иначе перебивают кнопки внутри карточки.
  const primaryClass = "flex h-12 w-full items-center justify-center rounded-full bg-[#E86A3A] px-4 text-[15px] font-semibold !text-white !no-underline transition-colors hover:bg-[#C24E22] hover:!text-white";
  const primaryLabel = card.ctaLabel || "Подробнее";
  const shift = card.ctaMode === "camp-shift" ? card.schedulePreview[0] ?? null : null;
  return (
    <div ref={rootRef}>
      <CollectionPublicationFrame
        title={card.title}
        media={<CollectionEventMediaGallery items={card.mediaItems ?? []} title={card.title} />}
        identity={<PublicationIdentityBadges category={card.typeLabel || "Предложение"} age={card.ageLabel} />}
        description={card.shortDescription ? <p className="m-0">{card.shortDescription}</p> : undefined}
        sections={card.sections}
      >
        <CollectionSchedulePrice
          label={shift ? "Ближайшая смена" : "Предложение"}
          date={shift?.dateFrom ? `${shift.dateFrom}${shift.dateTo ? ` — ${shift.dateTo}` : ""}` : card.placeName || card.formatLabel || card.typeLabel}
          detail={shift ? card.placeName : undefined}
          price={card.priceLabel}
        />
        {card.ratingCount ? <div className="pt-3"><CollectionRating value={card.ratingValue} count={card.ratingCount} /></div> : null}
        {card.venuePitch ? <CollectionVenueQuote text={card.venuePitch} /> : null}
        {card.visitorNote ? <CollectionNote text={card.visitorNote} /> : null}
        <div className="mt-4 flex flex-col gap-2.5">
          {action === "lead" ? (
            <button type="button" onClick={() => setLeadOpen(true)} className={primaryClass}>Оставить заявку</button>
          ) : action === "camp-shift" && shift ? (
            <button type="button" onClick={() => setBookingOpen(true)} className={primaryClass}>{primaryLabel}</button>
          ) : action === "phone" && phone ? (
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className={primaryClass}>{primaryLabel}</a>
          ) : action === "external" && card.ctaHref ? (
            <a href={card.ctaHref} target="_blank" rel="noopener noreferrer" className={primaryClass}>{primaryLabel}</a>
          ) : (
            <Link href={card.href} className={primaryClass}>{primaryLabel}</Link>
          )}
          <PublicationActionButtons
            onShare={() => setShareOpen(true)}
            saveControl={
              <SaveHeart
                activityId={card.offerId}
                offerId={card.offerId}
                activityTitle={card.title}
                coverImageUrl={card.imageUrl}
                source="article-collection-offer"
                triggerLabel="Сохранить"
                className={cn(PUBLICATION_SAVE_ACTION_CLASS, "!rounded-2xl")}
              />
            }
          />
          {action !== "details" ? <Link href={card.href} className="text-center text-[13px] font-medium !text-[#141210] underline-offset-4 hover:underline">Подробнее о предложении</Link> : null}
        </div>
        {phone ? (
          <div className="mt-1.5">
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] !text-[#6B6259] !no-underline hover:!text-[#141210]">
              <Phone className="size-[15px]" aria-hidden="true" />
              {phone}
            </a>
          </div>
        ) : null}
      </CollectionPublicationFrame>
      <ShareModal open={shareOpen} onOpenChange={setShareOpen} url={typeof window !== "undefined" ? `${window.location.origin}${card.href}` : card.href} title={card.title} />
      {card.ctaMode === "camp-shift" && shift ? (
        <CampShiftBookingOverlay open={bookingOpen} onOpenChange={setBookingOpen} offerId={card.offerId} offerTitle={card.title} shift={shift} shifts={card.schedulePreview} />
      ) : null}
      {hasLead ? <CollectionLeadSheet card={card} open={leadOpen} onOpenChange={setLeadOpen} /> : null}
    </div>
  );
}
