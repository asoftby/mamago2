"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SaveHeart } from "@/features/save/SaveHeart";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderPriceWithIcon } from "@/components/icons/BelarusianRubleIcon";

export type OfferCardProps = {
  id: string;
  title: string;
  href: string;
  imageUrl?: string | null;
  /** Label shown below image in mono caps, e.g. "Лагерь", "Курс" */
  categoryLabel?: string;
  /** Short placeholder text shown centred in the stripe background */
  placeholderLabel?: string;
  /** Date shown below title next to age, e.g. "20 июл.–18 авг." */
  dateLabel?: string;
  /** Price badge on bottom-right of image, e.g. "от 650 BYN" */
  priceLabel?: string;
  /** Promo badge on top-right, e.g. "-10% до 31.05" */
  promoBadge?: string;
  /** ISO date for the save-to-plan modal */
  saveDateISO?: string | null;
  saveDateEndISO?: string | null;
  saveSource?: string;
  /** Hide the save heart button (e.g. on the ideas page) */
  hideSave?: boolean;
  className?: string;
};

export function OfferCard({
  id,
  title,
  href,
  imageUrl,
  categoryLabel,
  placeholderLabel,
  dateLabel,
  priceLabel,
  promoBadge,
  saveDateISO,
  saveDateEndISO,
  saveSource,
  hideSave,
  className,
}: OfferCardProps) {
  return (
    <div className={cn("group relative flex flex-col gap-3", className)}>
      <Link href={href} className="block focus:outline-none">
        {/* Image / placeholder */}
        <div
          className="relative overflow-hidden rounded-[18px] bg-[#EDE8DF]"
          style={{ aspectRatio: "4/5" }}
        >
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-[1000ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 9px, rgba(20,18,16,0.07) 9px, rgba(20,18,16,0.07) 10px)",
              }}
            >
              {(placeholderLabel ?? categoryLabel) && (
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[rgba(20,18,16,0.30)]">
                  {placeholderLabel ?? categoryLabel}
                </span>
              )}
            </div>
          )}

          {/* Promo badge — top right */}
          {promoBadge && (
            <span className="absolute right-3 top-3 inline-flex h-7 items-center rounded-full bg-[#E86A3A] px-3 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(232,106,58,0.35)]">
              {promoBadge}
            </span>
          )}

          {/* Price badge — bottom right */}
          {priceLabel && (
            <span className="absolute bottom-3 right-3 inline-flex h-7 items-center rounded-full px-3 font-mono text-[11px] font-medium backdrop-blur-[4px] bg-[rgba(20,18,16,0.72)] text-white">
              {renderPriceWithIcon(normalizeUiCurrencyText(priceLabel ?? ""))}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="mt-3 flex flex-col gap-1 px-0.5">
          {categoryLabel && (
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
              {categoryLabel}
            </div>
          )}
          <div className="line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#141210] transition-colors group-hover:text-[#C24E22]">
            {title}
          </div>
          {dateLabel && (
            <div className="mt-0.5 font-mono text-[12px] text-[rgba(20,18,16,0.55)]">
              {dateLabel}
            </div>
          )}
        </div>
      </Link>

      {/* SaveHeart outside Link to prevent navigation */}
      {!hideSave && (
        <SaveHeart
          activityId={id}
          offerId={id}
          activityTitle={title}
          coverImageUrl={imageUrl}
          eventPlanDateISO={saveDateISO ?? null}
          eventPlanDateEndISO={saveDateEndISO ?? null}
          source={saveSource}
          className="absolute right-3 top-3 h-8 w-8 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px]"
          iconClassName="h-4 w-4"
        />
      )}
    </div>
  );
}
