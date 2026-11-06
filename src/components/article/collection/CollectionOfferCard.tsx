"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Baby, ChevronLeft, ChevronRight, MapPin, Phone, Plus } from "lucide-react";
import { SaveHeart } from "@/features/save/SaveHeart";
import { CampShiftBookingOverlay } from "@/components/offers/CampShiftBookingOverlay";
import { cn } from "@/lib/utils";
import type { ResolvedOfferEmbedCard } from "@/lib/article/articleMvpRenderData";
import { CollectionLeadSheet } from "./CollectionLeadSheet";
import { collectionPrimaryAction } from "@/lib/article/collectionCardCta";
import { LEAD_RETURN_PARAM } from "@/lib/article/collectionLeadForm";
import { CollectionChip, CollectionNote, CollectionRating, CollectionVenueQuote } from "./CollectionCardParts";

function Gallery({ card }: { card: ResolvedOfferEmbedCard }) {
  const urls = card.galleryUrls?.length ? card.galleryUrls : card.imageUrl ? [card.imageUrl] : [];
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const go = (d: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * Math.max(0, Math.min(urls.length - 1, i + d)), behavior: "smooth" });
  };
  return (
    <div className="group relative">
      <div
        ref={ref}
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.length ? (
          urls.map((u, k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u + k} src={u} alt={k === 0 ? card.title : ""} loading="lazy" decoding="async" className="aspect-[4/3] w-full shrink-0 snap-start object-cover md:aspect-[16/10]" />
          ))
        ) : (
          <div className="aspect-[4/3] w-full shrink-0 bg-[#EFE7DD] md:aspect-[16/10]" />
        )}
      </div>
      <div className="absolute right-3 top-3 z-[2]">
        <SaveHeart
          activityId={card.offerId}
          offerId={card.offerId}
          activityTitle={card.title}
          coverImageUrl={card.imageUrl}
          source="article-collection-offer"
          className="h-11 w-11 !rounded-full !bg-[rgba(250,247,241,.96)] !shadow-[0_4px_14px_rgba(20,18,16,.18)]"
        />
      </div>
      {i > 0 ? (
        <button type="button" onClick={() => go(-1)} aria-label="Предыдущее фото" className="absolute left-2.5 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#FAF7F1] shadow-md md:group-hover:flex">
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      {i < urls.length - 1 ? (
        <button type="button" onClick={() => go(1)} aria-label="Следующее фото" className="absolute right-2.5 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#FAF7F1] shadow-md md:group-hover:flex">
          <ChevronRight className="size-4" />
        </button>
      ) : null}
      {urls.length > 1 ? (
        <span className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-[5px] rounded-full bg-[rgba(20,18,16,.62)] px-2 py-[5px]" aria-label={`Фото ${i + 1} из ${urls.length}`}>
          {urls.map((_, k) => (
            <i key={k} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-4 bg-white" : "w-1.5 bg-white/50")} />
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** Карточка предложения внутри подборки: одинаково устроена для платных и бесплатных участников. */
export function CollectionOfferCard({ card }: { card: ResolvedOfferEmbedCard }) {
  const [open, setOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
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
  const primaryClass = "inline-flex min-h-12 items-center justify-center rounded-full bg-[#E86A3A] px-5 text-[15px] font-semibold text-white hover:bg-[#C24E22]";
  const primaryLabel = card.ctaLabel || "Подробнее";
  const shift = card.ctaMode === "camp-shift" ? card.schedulePreview[0] ?? null : null;
  return (
    <article ref={rootRef} aria-label={card.title} className="not-prose overflow-hidden rounded-3xl border border-[rgba(20,18,16,.1)] bg-[#FAF7F1] font-sans text-[#141210] shadow-[0_24px_50px_-38px_rgba(20,18,16,.3)]">
      <Gallery card={card} />
      <div className="px-4 pb-3.5 pt-4 md:px-6 md:pb-4 md:pt-[22px]">
        <div className="font-mono text-[11px] uppercase tracking-[.12em] text-[#6B6259]">
          {[card.placeName, card.typeLabel].filter(Boolean).join(" · ")}
        </div>
        <h3 className="mb-2 mt-1.5 font-serif text-[28px] font-normal leading-[1.05] tracking-tight [text-wrap:balance] md:text-[32px]">{card.title}</h3>
        <CollectionRating value={card.ratingValue} count={card.ratingCount} />
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {card.ageLabel ? <CollectionChip icon={<Baby />}>{card.ageLabel}</CollectionChip> : null}
          {card.placeName ? <CollectionChip icon={<MapPin />}>{card.placeName}</CollectionChip> : null}
          {card.priceLabel ? <CollectionChip strong>{card.priceLabel}</CollectionChip> : null}
        </div>
        {card.venuePitch ? <CollectionVenueQuote text={card.venuePitch} /> : null}
        {card.visitorNote ? <CollectionNote text={card.visitorNote} /> : null}
        {card.shortDescription ? (
          <div className="mt-3.5 border-t border-[rgba(20,18,16,.1)]">
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 w-full items-center justify-between text-left font-serif text-[16.5px]">
              Описание
              <Plus className={cn("size-4 text-[#6B6259] transition-transform", open && "rotate-45 text-[#C24E22]")} />
            </button>
            {open ? <p className="m-0 pb-3.5 text-[14.5px] leading-relaxed text-[#3A332B]">{card.shortDescription}</p> : null}
            <div className="border-b border-[rgba(20,18,16,.1)]" />
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 md:grid-cols-[auto_auto] md:justify-start">
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
          <Link href={card.href} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(20,18,16,.18)] px-5 text-[15px] font-semibold hover:border-[#141210]">
            Подробнее
          </Link>
        </div>
        {phone ? (
          <div className="mt-1.5">
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] text-[#6B6259] hover:text-[#141210]">
              <Phone className="size-[15px]" aria-hidden="true" />
              {phone}
            </a>
          </div>
        ) : null}
      </div>
      {card.ctaMode === "camp-shift" && shift ? (
        <CampShiftBookingOverlay open={bookingOpen} onOpenChange={setBookingOpen} offerId={card.offerId} offerTitle={card.title} shift={shift} shifts={card.schedulePreview} />
      ) : null}
      {hasLead ? <CollectionLeadSheet card={card} open={leadOpen} onOpenChange={setLeadOpen} /> : null}
    </article>
  );
}
