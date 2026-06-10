"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SaveHeart } from "@/features/save/SaveHeart";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";

// ─── Public props ────────────────────────────────────────────────────────────

export type EventCardProps = {
  id: string;
  title: string;
  href: string;
  imageUrl?: string | null;
  /** Моно-капсы под изображением: "СПЕКТАКЛИ", "СПЕКТАКЛИ · ОНЛАЙН" и т.д. */
  categoryLabel?: string;
  /** Строка мета: "12+ · 6–7 июн." */
  metaLabel?: string;
  /** Бейдж цены на обложке: "от 48 б", "бесплатно" */
  priceLabel?: string;
  /** Отношение сторон обложки, по умолчанию 4/5 */
  coverRatio?: string;
  saveMeta?: {
    dateISO?: string | null;
    dateEndISO?: string | null;
    source?: string;
  };
  className?: string;
};

const ONLINE_SEGMENT = /^онлайн$/i;

function OnlinePulseDot() {
  return (
    <span
      className="relative mx-1.5 inline-flex h-1.5 w-1.5 shrink-0 self-center"
      aria-hidden
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
    </span>
  );
}

function EventCardCategoryLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const parts = label
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div
      className={cn(
        "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]",
        className,
      )}
    >
      {parts.map((part, index) => {
        const isOnline = ONLINE_SEGMENT.test(part);

        return (
          <span key={`${part}-${index}`} className="inline-flex items-center">
            {index > 0 &&
              (isOnline ? <OnlinePulseDot /> : <span className="mx-1">·</span>)}
            <span className={isOnline ? "text-[var(--success)]" : undefined}>{part}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EventCard({
  id,
  title,
  href,
  imageUrl,
  categoryLabel,
  metaLabel,
  priceLabel,
  coverRatio = "4/5",
  saveMeta,
  className,
}: EventCardProps) {
  return (
    <div className={cn("group relative select-none", className)}>
      <Link href={href} className="block focus:outline-none">
        {/* Cover */}
        <div
          className="relative overflow-hidden rounded-[18px] bg-[#EDE8DF]"
          style={{ aspectRatio: coverRatio }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 9px, rgba(20,18,16,0.07) 9px, rgba(20,18,16,0.07) 10px)",
              }}
            >
              {categoryLabel && (
                <EventCardCategoryLabel
                  label={categoryLabel}
                  className="text-[11px] tracking-[0.18em] text-[rgba(20,18,16,0.30)]"
                />
              )}
            </div>
          )}

          {/* Price badge — bottom right */}
          {priceLabel && (
            <span className="absolute bottom-3 right-3 inline-flex h-7 items-center rounded-full bg-[rgba(20,18,16,0.72)] px-3 font-mono text-[11px] font-medium text-white backdrop-blur-[4px]">
              {normalizeUiCurrencyText(priceLabel)}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="mt-3 flex flex-col gap-1 px-0.5">
          {categoryLabel && <EventCardCategoryLabel label={categoryLabel} />}
          <div className="line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#141210] transition-colors duration-150 group-hover:text-[#C24E22]">
            {title}
          </div>
          {metaLabel && (
            <div className="mt-0.5 font-mono text-[12px] text-[rgba(20,18,16,0.55)]">
              {metaLabel}
            </div>
          )}
        </div>
      </Link>

      {/* SaveHeart — outside Link to prevent navigation */}
      {saveMeta && (
        <SaveHeart
          activityId={id}
          activityTitle={title}
          coverImageUrl={imageUrl}
          eventPlanDateISO={saveMeta.dateISO ?? null}
          eventPlanDateEndISO={saveMeta.dateEndISO ?? null}
          source={saveMeta.source}
          className="absolute right-3 top-3 h-8 w-8 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px]"
          iconClassName="h-4 w-4"
        />
      )}
    </div>
  );
}
