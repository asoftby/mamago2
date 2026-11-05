"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { EVENT_CARD_IMAGE_SIZES } from "@/components/events/eventCardLayout";
import { canOptimizeWithNextImage } from "@/lib/media/nextImagePolicy";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

/** Canonical cover used by public event, class and party offer cards. */
export function PublicCatalogCardCover({
  imageUrl, title, aspectRatio = "4/5", imagePriority = false, coverFit = "cover",
  imageSizes = EVENT_CARD_IMAGE_SIZES, objectPositionClass, animateOnHover = false,
  posterCrop, placeholder, children,
}: {
  imageUrl?: string | null; title: string; aspectRatio?: string; imagePriority?: boolean;
  coverFit?: "contain" | "cover"; imageSizes?: string; objectPositionClass?: string;
  animateOnHover?: boolean; posterCrop?: string; placeholder?: ReactNode; children?: ReactNode;
}) {
  const fit = coverFit === "contain" ? "object-contain" : "object-cover";
  const imageClassName = cn(fit, objectPositionClass,
    animateOnHover && "transition-transform duration-[1000ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]");
  return <div className="relative overflow-hidden rounded-[18px] bg-[#EDE8DF]"
    style={{ aspectRatio }} data-masonry-media data-poster-crop={posterCrop}>
    {imageUrl && canOptimizeWithNextImage(imageUrl) ? (
      <Image src={imageUrl} alt={title} fill sizes={imageSizes}
        loading={imagePriority ? "eager" : "lazy"}
        fetchPriority={imagePriority ? "high" : undefined} className={imageClassName} />
    ) : imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- external hosts are not always allowlisted.
      <img src={imageUrl} alt={title} loading={imagePriority ? "eager" : "lazy"}
        fetchPriority={imagePriority ? "high" : undefined}
        className={cn("h-full w-full", imageClassName)} />
    ) : (
      <div className="flex h-full w-full items-center justify-center"
        style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 9px, rgba(20,18,16,0.07) 9px, rgba(20,18,16,0.07) 10px)" }}>
        {placeholder}
      </div>
    )}
    {children}
  </div>;
}

const ONLINE_SEGMENT = /^онлайн$/i;

function OnlinePulseDot() {
  return <span className="relative mx-1.5 inline-flex h-1.5 w-1.5 shrink-0 self-center" aria-hidden>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
  </span>;
}

/** One category caption for every public catalog card, including online marking. */
export function PublicCatalogCardCategory({ label, placeholder = false }: {
  label: string; placeholder?: boolean;
}) {
  const parts = label.split(" · ").map(part => part.trim()).filter(Boolean);
  return <div className={cn("font-mono font-medium uppercase",
    placeholder ? "text-[11px] tracking-[0.18em] text-[rgba(20,18,16,0.30)]"
      : "text-[10px] tracking-[0.14em] text-[rgba(20,18,16,0.55)]")}>
    {parts.map((part, index) => {
      const online = ONLINE_SEGMENT.test(part);
      return <span key={index} className="inline-flex items-center">
        {index > 0 && (online ? <OnlinePulseDot /> : <span className="mx-1">·</span>)}
        <span className={online ? "text-[var(--success)]" : undefined}>{part}</span>
      </span>;
    })}
  </div>;
}

/** Canonical spacing, text baseline, separators and price glyph for all public catalog cards. */
export function PublicCatalogCardMeta({ label, priceLabel }: {
  label?: string | null; priceLabel?: string | null;
}) {
  if (!label && !priceLabel) return null;
  const isFree = Boolean(priceLabel && /бесплатно|^free$/i.test(priceLabel.trim()));
  return <div className="mt-0.5 flex flex-wrap items-center gap-x-1 font-mono text-[12px] leading-none text-[rgba(20,18,16,0.55)]">
    {label && <span className="inline-flex items-center leading-none">{label}</span>}
    {label && priceLabel && <span className="inline-flex items-center leading-none" aria-hidden="true">·</span>}
    {priceLabel && <span className={cn("inline-flex items-center leading-none",
      isFree ? "font-medium text-[var(--success)]" : "text-[#141210]")}>
      {renderCurrencyText(normalizeUiCurrencyText(priceLabel), { iconSize: "card" })}
    </span>}
  </div>;
}

export function PublicCatalogCardDetails({ category, title, label, priceLabel }: {
  category?: ReactNode; title: string; label?: string | null; priceLabel?: string | null;
}) {
  return <div className="mt-3 flex flex-col gap-1 px-0.5">
    {category}
    <div className="line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#141210] transition-colors duration-150 group-hover:text-[#C24E22]">{title}</div>
    <PublicCatalogCardMeta label={label} priceLabel={priceLabel} />
  </div>;
}
