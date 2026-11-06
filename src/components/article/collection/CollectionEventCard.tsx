"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, Plus, Share2 } from "lucide-react";
import { PlaceInfoRow } from "@/components/shared/PlaceInfoRow";
import { PublicationPriceDisplay } from "@/components/shared/PublicationPriceDisplay";
import { ShareModal } from "@/components/shared/ShareModal";
import { PUBLICATION_BADGE_CLASS } from "@/components/publication-page/publicationStyles";
import { SaveHeart } from "@/features/save/SaveHeart";
import { cn } from "@/lib/utils";
import type { ResolvedActivityCard } from "@/lib/article/articleMvpRenderData";

const monoLabel = "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]";
// `!`: стили ссылок статьи иначе перебивают кнопки внутри карточки.
const primaryClass = "flex h-12 w-full items-center justify-center rounded-full bg-[#E86A3A] text-[15px] font-semibold !text-white !no-underline transition-colors hover:bg-[#C24E22] hover:!text-white";
const secondaryClass = "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[rgba(20,18,16,.18)] bg-transparent px-4 text-[15px] font-semibold text-[#141210] transition-colors hover:border-[#141210]";

/**
 * Карточка события афиши в подборке: постер в своих пропорциях слева, справа — категория, возраст,
 * название, ближайший сеанс, цена, площадка и действия; «шторка» с описанием раскрывается под карточкой.
 * Живого обратного отсчёта нет намеренно: на нескольких карточках он давал бы таймеры ради косметики.
 */
export function CollectionEventCard({ card, activityId }: { card: ResolvedActivityCard; activityId: string }) {
  const e = card.event;
  const [descOpen, setDescOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const descId = `ev-desc-${activityId}`;

  return (
    <article aria-label={card.title} className="not-prose overflow-hidden rounded-3xl border border-[rgba(20,18,16,.1)] bg-[#FAF7F1] p-4 font-sans text-[#141210] shadow-[0_24px_50px_-38px_rgba(20,18,16,.3)] md:p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start md:gap-6">
        <div className="overflow-hidden rounded-2xl">
          {e?.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.posterUrl} alt={card.title} loading="lazy" decoding="async" className="block h-auto w-full max-h-[560px] object-contain object-top md:max-h-[640px]" />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center bg-[#EFE7DD] text-[#B4ABA0]">
              <Calendar className="size-9" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {e?.categoryLabel ? <span className={PUBLICATION_BADGE_CLASS}>{e.categoryLabel}</span> : <span className={monoLabel}>Афиша</span>}
            {e?.ageLabel ? <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">{e.ageLabel}</span> : null}
          </div>

          <h3 className="!m-0 !text-[26px] !font-semibold !leading-[1.12] !tracking-[-0.02em] [text-wrap:balance] md:!text-[30px]">{card.title}</h3>

          <div className="rounded-[20px] border border-[rgba(20,18,16,.1)] bg-white/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-[rgba(20,18,16,.1)] pb-4">
              <div>
                <div className={cn(monoLabel, "mb-1.5")}>Ближайший сеанс</div>
                {e?.dateLabel ? (
                  <>
                    <div className="text-[19px] font-semibold leading-tight tracking-[-0.02em]">{e.dateLabel}</div>
                    {e.timeLabel ? <div className="mt-1 font-mono text-[13px] text-[rgba(20,18,16,0.55)]">начало в {e.timeLabel}</div> : null}
                  </>
                ) : (
                  <div className="text-[15px] text-[rgba(20,18,16,0.55)]">Расписание уточняется</div>
                )}
              </div>
              <PublicationPriceDisplay label={e?.priceLabel} />
            </div>

            {e?.venue ? (
              <div className="pt-4">
                <PlaceInfoRow name={e.venue.name} address={e.venue.address} district={e.venue.district} metro={e.venue.metro} href={e.venue.href} />
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2.5">
              <Link href={card.href} className={primaryClass}>
                {e?.isFree ? "Записаться" : "Подробнее"}
              </Link>
              <div className="grid grid-cols-2 gap-2.5">
                <SaveHeart
                  activityId={activityId}
                  activityTitle={card.title}
                  coverImageUrl={e?.posterUrl}
                  source="article-collection-event-plan"
                  triggerLabel="В план"
                  className={cn(secondaryClass, "min-h-12 w-full")}
                />
                <button type="button" onClick={() => setShareOpen(true)} className={secondaryClass}>
                  <Share2 className="size-[18px]" aria-hidden="true" />
                  Поделиться
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {e?.descriptionText ? (
        <div className="mt-4 border-t border-[rgba(20,18,16,.1)]">
          <button
            type="button"
            aria-expanded={descOpen}
            aria-controls={descId}
            onClick={() => setDescOpen((v) => !v)}
            className="flex min-h-12 w-full items-center justify-between text-left font-serif text-[16.5px]"
          >
            Описание
            <Plus className={cn("size-4 text-[#6B6259] transition-transform", descOpen && "rotate-45 text-[#C24E22]")} aria-hidden="true" />
          </button>
          {descOpen ? (
            <p id={descId} className="m-0 pb-1 text-[14.5px] leading-relaxed text-[#3A332B] [text-wrap:pretty]">
              {e.descriptionText}
            </p>
          ) : null}
        </div>
      ) : null}

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={typeof window !== "undefined" ? `${window.location.origin}${card.href}` : card.href}
        title={card.title}
      />
    </article>
  );
}
