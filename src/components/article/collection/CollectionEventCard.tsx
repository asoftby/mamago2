import Link from "next/link";
import { Baby, Calendar, MapPin } from "lucide-react";
import { SaveHeart } from "@/features/save/SaveHeart";
import type { ResolvedActivityCard } from "@/lib/article/articleMvpRenderData";
import { CollectionChip } from "./CollectionCardParts";

/** Карточка события афиши в подборке. Постер — в своих пропорциях на тёмном поле, без размытых подложек. */
export function CollectionEventCard({ card, activityId }: { card: ResolvedActivityCard; activityId: string }) {
  const e = card.event;
  return (
    <article aria-label={card.title} className="not-prose overflow-hidden rounded-3xl border border-[rgba(20,18,16,.1)] bg-[#FAF7F1] font-sans text-[#141210] shadow-[0_24px_50px_-38px_rgba(20,18,16,.3)]">
      <div className="relative flex min-h-40 justify-center bg-[#141210]">
        {e?.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.posterUrl} alt={card.title} loading="lazy" decoding="async" className="max-h-[560px] w-auto max-w-full object-contain md:max-h-[640px]" />
        ) : (
          <div className="flex w-full items-center justify-center text-white/50">
            <Calendar className="size-9" aria-hidden="true" />
          </div>
        )}
        <div className="absolute right-3 top-3 z-[2]">
          <SaveHeart
            activityId={activityId}
            activityTitle={card.title}
            coverImageUrl={e?.posterUrl}
            source="article-collection-event"
            className="h-11 w-11 !rounded-full !bg-[rgba(250,247,241,.96)] !shadow-[0_4px_14px_rgba(20,18,16,.18)]"
          />
        </div>
      </div>
      <div className="px-4 pb-3.5 pt-4 md:px-6 md:pb-4 md:pt-[22px]">
        <div className="font-mono text-[11px] uppercase tracking-[.12em] text-[#6B6259]">Афиша</div>
        <h3 className="mb-2 mt-1.5 font-serif text-[28px] font-normal leading-[1.05] tracking-tight [text-wrap:balance] md:text-[32px]">{card.title}</h3>
        {e?.dateLabel ? (
          <div className="flex items-center gap-2.5 text-[#C24E22]">
            <Calendar className="size-[18px]" aria-hidden="true" />
            <b className="text-[17px] font-bold text-[#141210]">{e.dateLabel}</b>
          </div>
        ) : null}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {e?.ageLabel ? <CollectionChip icon={<Baby />}>{e.ageLabel}</CollectionChip> : null}
          {e?.placeLabel ? <CollectionChip icon={<MapPin />}>{e.placeLabel}</CollectionChip> : null}
          {e?.priceLabel ? <CollectionChip strong>{e.priceLabel}</CollectionChip> : null}
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 md:grid-cols-[auto_auto] md:justify-start">
          <Link href={card.href} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#E86A3A] px-5 text-[15px] font-semibold text-white hover:bg-[#C24E22]">
            {e?.isFree ? "Записаться" : "Подробнее"}
          </Link>
          <SaveHeart
            activityId={activityId}
            activityTitle={card.title}
            coverImageUrl={e?.posterUrl}
            source="article-collection-event-plan"
            triggerLabel="В план"
            className="min-h-12 rounded-full border border-[rgba(20,18,16,.18)] px-5 text-[15px] font-semibold"
          />
        </div>
      </div>
    </article>
  );
}
