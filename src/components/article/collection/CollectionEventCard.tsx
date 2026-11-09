"use client";

import Link from "next/link";
import { useState } from "react";
import { CollectionPublicationFrame } from "./CollectionPublicationFrame";
import { CollectionSchedulePrice } from "./CollectionSchedulePrice";
import { CollectionEventMediaGallery } from "./CollectionEventMediaGallery";
import { PlaceInfoRow } from "@/components/shared/PlaceInfoRow";
import { ShareModal } from "@/components/shared/ShareModal";
import { PublicationIdentityBadges } from "@/components/shared/PublicationIdentityBadges";
import { PublicationActionButtons, PUBLICATION_SAVE_ACTION_CLASS } from "@/components/shared/PublicationActionButtons";
import { SaveHeart } from "@/features/save/SaveHeart";
import { cn } from "@/lib/utils";
import type { ResolvedActivityCard } from "@/lib/article/articleMvpRenderData";

// `!`: стили ссылок статьи иначе перебивают кнопки внутри карточки.
const primaryClass = "flex h-12 w-full items-center justify-center rounded-full bg-[#E86A3A] text-[15px] font-semibold !text-white !no-underline transition-colors hover:bg-[#C24E22] hover:!text-white";

/**
 * Карточка события афиши в подборке: постер в своих пропорциях слева, справа — категория, возраст,
 * название, ближайший сеанс, цена, площадка и действия; «шторка» с описанием раскрывается под карточкой.
 * Живого обратного отсчёта нет намеренно: на нескольких карточках он давал бы таймеры ради косметики.
 */
export function CollectionEventCard({ card, activityId }: { card: ResolvedActivityCard; activityId: string }) {
  const e = card.event;
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <CollectionPublicationFrame
        title={card.title}
        media={<CollectionEventMediaGallery items={e?.mediaItems ?? []} title={card.title} />}
        identity={<PublicationIdentityBadges category={e?.categoryLabel ?? "Афиша"} age={e?.ageLabel} />}
        description={e?.descriptionText ? <p className="m-0">{e.descriptionText}</p> : undefined}
      >
            <CollectionSchedulePrice
              label="Ближайший сеанс"
              date={e?.dateLabel}
              detail={e?.timeLabel ? `начало в ${e.timeLabel}` : undefined}
              price={e?.priceLabel}
            />

            {e?.venue ? (
              <div className="pt-4">
                <PlaceInfoRow name={e.venue.name} address={e.venue.address} district={e.venue.district} metro={e.venue.metro} href={e.venue.href} />
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2.5">
              <Link href={card.href} className={primaryClass}>
                {e?.isFree ? "Записаться" : "Подробнее"}
              </Link>
              <PublicationActionButtons
                onShare={() => setShareOpen(true)}
                saveControl={
                  <SaveHeart
                    activityId={activityId}
                    activityTitle={card.title}
                    coverImageUrl={e?.posterUrl}
                    source="article-collection-event-plan"
                    triggerLabel="Сохранить"
                    className={cn(PUBLICATION_SAVE_ACTION_CLASS, "!rounded-2xl")}
                  />
                }
              />
            </div>
      </CollectionPublicationFrame>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={typeof window !== "undefined" ? `${window.location.origin}${card.href}` : card.href}
        title={card.title}
      />
    </>
  );
}
