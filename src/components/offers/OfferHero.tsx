"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Play,
  MapPin,
  Heart,
  Share2,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { Button } from "@/components/ui/button";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { OwnerOfferEditDropdown } from "./OwnerOfferEditDropdown";

interface OfferHeroProps {
  data: OfferPageData;
  canEditOffer?: boolean;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isInPlan?: boolean;
  isSaved?: boolean;
  onPrimary: () => void;
  onSave: () => void;
}

/**
 * Hero-зона страницы предложения — Editorial style.
 *
 * Визуальная идентичность:
 * - Заголовок в Instrument Serif (display) с italic-акцентом
 * - Kicker mono-caps вместо «оранжевого» лейбла-плашки
 * - Карточка брони с прерывистой обводкой и крупной serif-ценой
 * - Список скидок вместо одной плашки
 */
export function OfferHero({
  data,
  canEditOffer,
  isPrimaryLoading,
  isSecondaryLoading,
  isInPlan,
  isSaved,
  onPrimary,
  onSave,
}: OfferHeroProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMode, setLightboxMode] = useState<"gallery" | "video">("gallery");
  const [galleryIndex, setGalleryIndex] = useState(0);

  const hasVideo = Boolean(data.media.videoUrl);
  const gallery = data.media.gallery;
  const hasGallery = gallery.length > 0;
  const hasCover = Boolean(data.media.posterUrl);

  const openGallery = (idx: number) => {
    setGalleryIndex(idx);
    setLightboxMode("gallery");
    setLightboxOpen(true);
  };

  const openVideo = () => {
    setLightboxMode("video");
    setLightboxOpen(true);
  };

  const nextImage = () => setGalleryIndex((i) => (i + 1) % gallery.length);
  const prevImage = () => setGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length);

  const badgeLabel = useMemo(() => {
    switch (data.offerType) {
      case "CAMP":
        return "Лагерь";
      case "REGULAR":
        return "Занятия";
      case "SINGLE":
        return "Событие";
      default:
        return "Предложение";
    }
  }, [data.offerType]);

  /** Разделяем заголовок на две смысловые части для editorial-вёрстки:
   *  первое слово → serif roman, остальное → serif italic.
   *  Если заголовок одно слово — всё в roman. */
  const titleParts = useMemo(() => {
    const t = data.title?.trim() ?? "";
    const idx = t.indexOf(" ");
    if (idx === -1) return { head: t, tail: "" };
    return { head: t.slice(0, idx), tail: t.slice(idx + 1) };
  }, [data.title]);

  const THUMB_LIMIT = 5;
  const videoSlots = hasVideo ? 1 : 0;
  const imageSlots = THUMB_LIMIT - videoSlots;
  const hiddenCount = Math.max(0, gallery.length - imageSlots);

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com/watch")) {
      try {
        const id = new URL(url).searchParams.get("v");
        return `https://www.youtube.com/embed/${id}?autoplay=1`;
      } catch {
        return url;
      }
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    return url;
  };

  // kept for legacy callers that may still reference it
  const priceLabel = data.pricing.priceFrom || data.pricing.singlePrice;

  return (
    <section className="space-y-6 lg:space-y-10">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-[13px] text-[rgba(20,18,16,0.45)]"
      >
        <Link href="/" className="hover:text-[#3A332B] transition-colors">
          Главная
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/${data.citySlug}/offers`}
          className="hover:text-[#3A332B] transition-colors"
        >
          {badgeLabel}
        </Link>
        {data.place && (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={`/places/${data.place.slug}`}
              className="hover:text-[#3A332B] transition-colors truncate max-w-[160px]"
            >
              {data.place.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-[#3A332B] font-medium truncate max-w-[200px]">
          {data.title}
        </span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_440px] lg:gap-14 xl:gap-16">
        {/* ─── LEFT: title + image + thumbs ─── */}
        <div className="flex flex-col gap-7">
          {/* Kicker pills */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-7 items-center rounded-full bg-[#FFE8DC] px-3 text-[12px] font-semibold text-[#C24E22]">
              ● {badgeLabel}
            </span>
            {data.metaGrid.slice(0, 1).map((item) => (
              <span
                key={item.id}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.45)]"
              >
                {item.label} · {item.value}
              </span>
            ))}
          </div>

          {/* Editorial display title */}
          <h1
            className="font-[family-name:var(--font-display)] text-[clamp(48px,8vw,96px)] font-normal leading-[0.95] tracking-[-0.025em] text-[#141210]"
          >
            {titleParts.head}
            {titleParts.tail && (
              <>
                <br />
                <span className="italic text-[#C24E22]">
                  {titleParts.tail}
                </span>
              </>
            )}
          </h1>

          {/* Place + address */}
          {data.place && (
            <div className="space-y-0.5">
              <Link
                href={`/places/${data.place.slug}`}
                className="flex items-center gap-1.5 text-[15px] font-semibold text-[#141210] hover:text-[#E86A3A] transition-colors"
              >
                <MapPin className="h-4 w-4 shrink-0 text-[#E86A3A]" />
                {data.place.name}
              </Link>
              {data.place.address && (
                <p className="pl-[22px] text-[13px] text-[rgba(20,18,16,0.55)]">
                  {data.place.address}
                </p>
              )}
            </div>
          )}

          {/* Short description */}
          {data.shortDescription && (
            <p className="max-w-[560px] text-[17px] leading-[1.55] text-[#3A332B]">
              {data.shortDescription}
            </p>
          )}

          {/* Main image */}
          <button
            type="button"
            className="group relative w-full aspect-[16/10] overflow-hidden rounded-3xl bg-[#EDE8DF] shadow-sm cursor-pointer"
            onClick={() => {
              if (hasGallery) openGallery(0);
              else if (hasVideo) openVideo();
            }}
          >
            {hasCover ? (
              <Image
                src={data.media.posterUrl!}
                alt={data.media.posterAlt ?? ""}
                fill
                className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]"
                priority
                sizes="(max-width: 1024px) 100vw, 760px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[#EDE8DF]">
                <ImageIcon className="h-16 w-16 text-[rgba(20,18,16,0.25)]" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_0_80px_rgba(0,0,0,0.10)]" />
            {hasVideo && !hasGallery && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/25">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FAF7F1]/95 shadow-2xl transition-transform group-hover:scale-110">
                  <Play className="h-8 w-8 fill-[#EF8759] text-[#E86A3A] ml-1" />
                </div>
              </div>
            )}
          </button>

          {/* Thumb strip */}
          {(hasGallery || hasVideo) && (
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
              {hasVideo && (
                <button
                  type="button"
                  onClick={openVideo}
                  className="relative h-[88px] w-[120px] shrink-0 overflow-hidden rounded-2xl bg-[#EDE8DF] ring-2 ring-transparent transition-all hover:ring-[#E86A3A]/60"
                >
                  {hasCover && (
                    <Image
                      src={data.media.posterUrl!}
                      alt="Видео"
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <Play className="h-5 w-5 fill-white text-white" />
                  </div>
                </button>
              )}

              {gallery.slice(0, imageSlots).map((img, idx) => {
                const isLastVisible = idx === imageSlots - 1 && hiddenCount > 0;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => openGallery(idx)}
                    className="relative h-[88px] w-[120px] shrink-0 overflow-hidden rounded-2xl bg-[#EDE8DF] ring-2 ring-transparent transition-all hover:ring-[#E86A3A]/60"
                  >
                    <Image
                      src={img.url}
                      alt={img.alt || ""}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                    {isLastVisible && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[15px] font-bold text-white">
                        +{hiddenCount}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── RIGHT: sticky booking card ─── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <BookingCard
            data={data}
            canEditOffer={canEditOffer}
            badgeLabel={badgeLabel}
            isPrimaryLoading={isPrimaryLoading}
            isSecondaryLoading={isSecondaryLoading}
            isInPlan={isInPlan}
            isSaved={isSaved}
            onPrimary={onPrimary}
            onSave={onSave}
          />
        </aside>
      </div>

      {/* ─── Lightbox (без изменений) ─── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-8"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-5 right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#FAF7F1]/10 text-white hover:bg-[#FAF7F1]/20"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxMode === "video" && data.media.videoUrl ? (
            <div
              className="relative w-full max-w-5xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={getEmbedUrl(data.media.videoUrl)}
                className="h-full w-full rounded-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : gallery.length > 0 ? (
            <>
              {gallery.length > 1 && (
                <button
                  type="button"
                  className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#FAF7F1]/10 text-white hover:bg-[#FAF7F1]/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              <div
                className="relative w-full max-w-5xl aspect-[4/3]"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={gallery[galleryIndex]?.url || ""}
                  alt={gallery[galleryIndex]?.alt || ""}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
              {gallery.length > 1 && (
                <button
                  type="button"
                  className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#FAF7F1]/10 text-white hover:bg-[#FAF7F1]/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#FAF7F1]/10 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
                {galleryIndex + 1} / {gallery.length}
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ─── Booking Countdown ────────────────────────────────────────────────────────

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeCountdown(until: string): CountdownTime | null {
  const diff = new Date(until).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

function BookingCountdown({ until }: { until: string }) {
  const compute = useCallback(() => computeCountdown(until), [until]);
  const [time, setTime] = useState<CountdownTime | null>(() => compute());

  useEffect(() => {
    const id = setInterval(() => setTime(compute()), 1_000);
    return () => clearInterval(id);
  }, [compute]);

  if (!time) return null;

  const cells = [
    { value: time.days, label: "ДНЕЙ" },
    { value: time.hours, label: "ЧАСОВ" },
    { value: time.minutes, label: "МИНУТ" },
    { value: time.seconds, label: "СЕК" },
  ];

  return (
    <div className="mb-5 grid grid-cols-4 overflow-hidden rounded-[22px] border border-dashed border-[rgba(20,18,16,0.18)] bg-[#FAF7F1]">
      {cells.map(({ value, label }, index) => (
        <div
          key={label}
          className={cn(
            "flex flex-col items-center px-2 py-3",
            index > 0 && "border-l border-[#F0E6DD]",
          )}
        >
          <span className="font-mono text-[28px] font-bold leading-none tabular-nums text-[#141210]">
            {String(value).padStart(2, "0")}
          </span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[rgba(20,18,16,0.45)]">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  data: OfferPageData;
  canEditOffer?: boolean;
  badgeLabel: string;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isInPlan?: boolean;
  isSaved?: boolean;
  onPrimary: () => void;
  onSave: () => void;
}

function BookingCard({
  data,
  canEditOffer,
  badgeLabel,
  isPrimaryLoading,
  isSecondaryLoading,
  isInPlan,
  isSaved,
  onPrimary,
  onSave,
}: BookingCardProps) {
  const p = data.pricing;
  const looksLikeHtml = (value?: string) =>
    typeof value === "string" && /<[a-z][\s\S]*>/i.test(value.trim());

  /* ── Resolve displayed price number + unit ── */
  const priceNumber = (() => {
    if (p.priceDisplay) return p.priceDisplay;
    const raw = (p.singlePrice || p.priceFrom || "").replace(/^от\s+/i, "");
    return raw.split(" ")[0] ?? "";
  })();

  const inlinePriceCaption =
    typeof p.priceCaption === "string" && p.priceCaption.trim() && !looksLikeHtml(p.priceCaption)
      ? p.priceCaption.trim()
      : "";

  const priceUnit = (() => {
    if (p.priceUnit) return p.priceUnit;
    const raw = (p.singlePrice || p.priceFrom || "").replace(/^от\s+/i, "");
    const parts = raw.split(" ");
    const currency = parts.slice(1).join(" ");
    return [currency, inlinePriceCaption].filter(Boolean).join(" / ");
  })();

  const hasDiscounts = Boolean(p.discounts && p.discounts.length > 0);

  const promoRichBlock = (() => {
    const parts = [p.priceCaption, hasDiscounts ? null : p.promotionDetails].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    if (parts.length === 0) return null;
    const htmlOnlyParts = parts.filter((value) => looksLikeHtml(value) || value.length > 90);
    if (htmlOnlyParts.length === 0) return null;
    return htmlOnlyParts.join("");
  })();

  const hasPromoBlock = Boolean(hasDiscounts || promoRichBlock);

  return (
    <>
      <div className="rounded-[24px] border border-[rgba(20,18,16,0.10)] bg-[#FAF7F1] p-6 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_30px_60px_-30px_rgba(20,18,16,0.18)]">

        {/* ── Header row: place name + rating ── */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.45)] truncate">
            &ldquo;{data.place?.name ?? badgeLabel}&rdquo;
          </span>
          {data.averageRating && (
            <span className="shrink-0 font-mono text-[11px] text-[#E86A3A]">
              ● {data.averageRating.toFixed(1)}
            </span>
          )}
        </div>

        {/* ── Price ── */}
        {priceNumber && (
          <div className="mb-2 flex items-end gap-2">
            <span className="font-[family-name:var(--font-display)] text-[72px] leading-[0.92] tracking-[-0.04em] text-[#141210]">
              {priceNumber}
            </span>
            {priceUnit && (
              <span className="pb-2 font-mono text-[12px] leading-tight text-[rgba(20,18,16,0.55)]">
                {priceUnit}
              </span>
            )}
          </div>
        )}

        {/* ── Old price + promo text ── */}
        {(p.oldPrice || p.promotionText) && (
          <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
            {p.oldPrice && (
              <span className="font-mono text-[rgba(20,18,16,0.30)] line-through">{p.oldPrice}</span>
            )}
            {p.promotionText && (
              <span className="font-semibold text-[#C24E22]">{p.promotionText}</span>
            )}
          </div>
        )}

        {/* ── Countdown ── */}
        {p.promoUntil && <BookingCountdown until={p.promoUntil} />}

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={onPrimary}
            disabled={isPrimaryLoading}
            className="h-14 flex-1 rounded-full bg-[#E86A3A] text-[15px] font-semibold text-white shadow-none transition-colors hover:bg-[#C24E22]"
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
            {isPrimaryLoading ? "Загрузка..." : data.cta.primaryLabel}
          </Button>
          <button
            type="button"
            aria-label={isSaved ? "Сохранено" : "Сохранить"}
            onClick={onSave}
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-all",
              isSaved
                ? "border-[#E86A3A] bg-[#FFE8DC] text-[#E86A3A]"
                : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.55)] hover:bg-[#FAF7F1] hover:text-[#3A332B]",
            )}
          >
            <Heart className={cn("h-5 w-5", isSaved && "fill-current")} />
          </button>
        </div>

        {canEditOffer ? (
          <div className="mt-4 border-t border-[rgba(20,18,16,0.10)] pt-4">
            <OwnerOfferEditDropdown
              offerId={data.id}
              offerType={data.offerType}
              className="w-full justify-between rounded-full border-black bg-black px-5"
            />
          </div>
        ) : null}

        {hasDiscounts && (
          <div className="mt-5 border-y border-[rgba(20,18,16,0.10)] py-4">
            <div className="space-y-3">
              {p.discounts!.map((d, i) => (
                <div key={i} className="flex items-start gap-5 text-[13px] leading-[1.5]">
                  <span className="min-w-[58px] shrink-0 font-mono text-[14px] font-bold tracking-[-0.02em] text-[#C24E22]">
                    {d.rate}
                  </span>
                  <span className="pt-0.5 text-[14px] text-[#3A332B]">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end text-[13px] text-[rgba(20,18,16,0.55)]">
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                navigator.share({ title: data.title, url: window.location.href });
              }
            }}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[#141210]"
          >
            <Share2 className="h-3.5 w-3.5" />
            Поделиться
          </button>
        </div>
      </div>

      {/* ── Trust badge ── */}
      <div className="mt-4 flex items-center gap-3 px-4 text-[12px] text-[rgba(20,18,16,0.55)]">
        <span className="relative inline-flex h-2 w-2 shrink-0 rounded-full bg-[#2FBF71] shadow-[0_0_0_4px_rgba(47,191,113,0.18)]" />
        Подтверждённый партнёр mamaGo · оплата возвращается за 24ч
      </div>

      {hasPromoBlock && (
        <div className="mt-4 rounded-[24px] border border-[rgba(20,18,16,0.10)] bg-[#FAF7F1] px-5 py-4 shadow-[0_18px_40px_-34px_rgba(49,32,17,0.22)]">
          {promoRichBlock && (
            <RichContentRenderer
              html={promoRichBlock}
              className={cn(
                "prose-p:my-1.5 prose-p:text-[13px] prose-p:leading-[1.6] prose-p:text-[#3A332B]",
                "prose-ul:my-1 prose-ul:pl-0 prose-ul:list-none",
                "prose-li:my-1.5 prose-li:leading-[1.6] prose-li:text-[#3A332B] prose-li:before:content-none",
                "prose-strong:font-semibold prose-strong:text-[#141210]",
              )}
            />
          )}
        </div>
      )}
    </>
  );
}
