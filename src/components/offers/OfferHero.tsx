"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Play,
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import type { OfferPageData, OfferScheduleItem } from "@/lib/offer/offerPageTypes";
import { Button } from "@/components/ui/button";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { OwnerOfferEditDropdown } from "./OwnerOfferEditDropdown";
import { PlaceInfoRow } from "@/components/shared/PlaceInfoRow";
import { SidebarCard, SidebarCardTopSection, SidebarCardShare } from "@/components/shared/SidebarCard";

interface OfferHeroProps {
  data: OfferPageData;
  canEditOffer?: boolean;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isInPlan?: boolean;
  isSaved?: boolean;
  onPrimary: () => void;
  onSave: () => void;
  ctaRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Hero-зона страницы предложения — Editorial style.
 *
 * Визуальная идентичность:
 * - Заголовок в основном интерфейсном шрифте с italic-акцентом
 * - Kicker mono-caps вместо «оранжевого» лейбла-плашки
 * - Карточка брони с прерывистой обводкой и крупной serif-ценой
 * - Список скидок вместо одной плашки
 */
export function OfferHero({
  data,
  canEditOffer,
  isPrimaryLoading,
  isSaved,
  onPrimary,
  onSave,
  ctaRef,
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

  return (
    <section className="space-y-6 lg:space-y-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[440px_1fr] lg:gap-14">
        {/* ─── LEFT: image + thumbs ─── */}
        <div className="flex flex-col gap-5">
          {/* Main image */}
          <button
            type="button"
            className="group relative w-full aspect-[4/3] overflow-hidden rounded-3xl bg-[#EDE8DF] shadow-sm cursor-pointer"
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
                unoptimized={isAppMediaUrl(data.media.posterUrl)}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
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
                      unoptimized={isAppMediaUrl(data.media.posterUrl)}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
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
                      unoptimized={isAppMediaUrl(img.url)}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
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

        {/* ─── RIGHT: breadcrumbs + kicker + title + booking card ─── */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-[13px] text-[rgba(20,18,16,0.45)]"
          >
            <Link href="/" className="hover:text-[#3A332B] transition-colors">Главная</Link>
            <span aria-hidden="true">›</span>
            <Link href={`/${data.citySlug}/offers`} className="hover:text-[#3A332B] transition-colors">
              {badgeLabel}
            </Link>
            {data.place && (
              <>
                <span aria-hidden="true">›</span>
                <Link href={`/places/${data.place.slug}`} className="hover:text-[#3A332B] transition-colors truncate max-w-[160px]">
                  {data.place.name}
                </Link>
              </>
            )}
            <span aria-hidden="true">›</span>
            <span className="text-[#3A332B] font-medium truncate max-w-[200px]">{data.title}</span>
          </nav>

          {/* Kicker pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex h-7 items-center rounded-full bg-[#FFE8DC] px-3 text-[12px] font-semibold text-[#E86A3A]">
              ● {badgeLabel}
            </span>
            {data.metaGrid.slice(0, 1).map((item) => (
              <span
                key={item.id}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.45)]"
              >
                {item.value}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.025em", color: "#141210" }}>
            {data.title}
          </h1>

          {/* Booking card */}
          <BookingCard
            data={data}
            canEditOffer={canEditOffer}
            badgeLabel={badgeLabel}
            isPrimaryLoading={isPrimaryLoading}
            isSaved={isSaved}
            onPrimary={onPrimary}
            onSave={onSave}
            ctaRef={ctaRef}
          />
        </div>

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
                  unoptimized={isAppMediaUrl(gallery[galleryIndex]?.url)}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
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

function parseOfferScheduleDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const parsed = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const WEEKDAY_GENITIVE: Record<string, string> = {
  понедельник: "понедельника",
  вторник: "вторника",
  среда: "среды",
  четверг: "четверга",
  пятница: "пятницы",
  суббота: "субботы",
  воскресенье: "воскресенья",
};

function formatOfferScheduleDate(value?: string | null): string | null {
  const parsed = parseOfferScheduleDate(value);
  if (!parsed) return null;

  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(parsed)
    .replace(/\s*г\.$/, "")
    .replace(".", "");

  // "понедельник, 20 июля 2026" → "Понедельник, 20 июля 2026"
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Форматирует дату окончания в родительном падеже для «До …» */
function formatOfferScheduleDateTo(value?: string | null): string | null {
  const parsed = parseOfferScheduleDate(value);
  if (!parsed) return null;

  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(parsed)
    .replace(/\s*г\.$/, "")
    .replace(".", "");

  const commaIdx = formatted.indexOf(",");
  if (commaIdx === -1) return formatted;
  const weekday = formatted.slice(0, commaIdx).toLowerCase();
  const rest = formatted.slice(commaIdx + 2);
  return `${WEEKDAY_GENITIVE[weekday] ?? weekday}, ${rest}`;
}

function pickNearestShift(items: OfferScheduleItem[]): OfferScheduleItem | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [...items]
    .sort((a, b) => {
      const aTs = parseOfferScheduleDate(a.dateFrom)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTs = parseOfferScheduleDate(b.dateFrom)?.getTime() ?? Number.POSITIVE_INFINITY;
      const aPast = aTs < today.getTime();
      const bPast = bTs < today.getTime();
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aTs - bTs;
    })[0] ?? null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralReviews(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} отзывов`;
  if (mod10 === 1) return `${n} отзыв`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} отзыва`;
  return `${n} отзывов`;
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  data: OfferPageData;
  canEditOffer?: boolean;
  badgeLabel: string;
  isPrimaryLoading?: boolean;
  isSaved?: boolean;
  onPrimary: () => void;
  onSave: () => void;
  ctaRef?: React.RefObject<HTMLElement | null>;
}

function BookingCard({
  data,
  canEditOffer,
  badgeLabel,
  isPrimaryLoading,
  isSaved,
  onPrimary,
  onSave,
  ctaRef,
}: BookingCardProps) {
  const p = data.pricing;
  const nearestShift = useMemo(() => {
    if (data.schedule?.type !== "shifts") return null;
    return pickNearestShift(data.schedule.items);
  }, [data.schedule]);
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
      ? normalizeUiCurrencyText(p.priceCaption.trim())
      : "";

  const priceUnit = (() => {
    if (p.priceUnit) return normalizeUiCurrencyText(p.priceUnit);
    const raw = (p.singlePrice || p.priceFrom || "").replace(/^от\s+/i, "");
    const parts = raw.split(" ");
    const currency = normalizeUiCurrencyText(parts.slice(1).join(" "));
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
  const nearestShiftDate = formatOfferScheduleDate(nearestShift?.dateFrom);
  const nearestShiftMeta = nearestShift?.dateTo
    ? `До ${formatOfferScheduleDateTo(nearestShift.dateTo) ?? nearestShift.dateTo}`
    : nearestShift?.title || nearestShift?.duration || nearestShift?.ageRange || null;

  const priceLabel = priceUnit || "";
  const priceLabelParts = priceLabel.split("/").map((part) => part.trim()).filter(Boolean);
  const currencyPart = priceLabelParts[0] ?? "";
  const priceSuffixPart = priceLabelParts.slice(1).join(" / ");

  return (
    <>
      <SidebarCard>

        {nearestShift && priceNumber ? (
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(20,18,16,0.10)] pb-5">
            <div>
              <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                Ближайшая смена
              </div>
              {nearestShiftDate ? (
                <div className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#141210]">
                  {nearestShiftDate}
                </div>
              ) : (
                <div className="text-[15px] text-[rgba(20,18,16,0.55)]">Расписание уточняется</div>
              )}
              {nearestShiftMeta && (
                <div className="mt-1.5 font-mono text-[13px] text-[rgba(20,18,16,0.55)]">
                  {nearestShiftMeta}
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                Стоимость
              </div>
              <div className="flex items-end justify-end gap-1.5">
                <span style={{ fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em", color: "#141210" }}>
                  {priceNumber}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                  {p.oldPrice && (
                    <span className="font-mono text-[11px] text-[rgba(20,18,16,0.30)] line-through">
                      {normalizeUiCurrencyText(p.oldPrice)}
                    </span>
                  )}
                  {priceLabel && (
                    <span className="font-mono text-[13px] text-[rgba(20,18,16,0.55)]">
                      {normalizeUiCurrencyText(priceLabel).replace(/ \/ /g, "/")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : priceNumber && (
          <div className="mb-2 flex items-end gap-2">
            <span className="font-sans text-[72px] font-semibold leading-[0.92] tracking-[-0.04em] text-[#141210]">
              {priceNumber}
            </span>
            {priceUnit && (
              <span className="pb-2 font-mono text-[12px] leading-tight text-[rgba(20,18,16,0.55)]">
                {normalizeUiCurrencyText(priceUnit).replace(/ \/ /g, "/")}
              </span>
            )}
          </div>
        )}

        {/* ── Place info ── */}
        {data.place && (
          <div className="mb-5">
            <PlaceInfoRow
              name={data.place.name}
              logoUrl={data.place.logoUrl}
              address={data.place.address}
              district={data.place.district}
              metro={data.place.metro}
              href={data.place.slug ? `/places/${data.place.slug}` : undefined}
            />
          </div>
        )}

        {/* ── Promo text (old price moved to price block) ── */}
        {p.promotionText && (
          <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold text-[#C24E22]">{p.promotionText}</span>
          </div>
        )}

        {/* ── Countdown ── */}
        {p.promoUntil && <BookingCountdown until={p.promoUntil} />}

        <div ref={ctaRef as React.RefObject<HTMLDivElement>} className="mt-6 flex items-center gap-3">
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
          <SidebarCardTopSection mt={16} pt={16}>
            <OwnerOfferEditDropdown
              offerId={data.id}
              offerType={data.offerType}
              className="h-14 w-full rounded-full border text-[16px] font-semibold"
            />
          </SidebarCardTopSection>
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

        <SidebarCardTopSection mt={20} pt={20}>
          <div className="flex items-center justify-between">
            {data.averageRating != null ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] text-[rgba(20,18,16,0.55)]">
                  <span className="text-[16px] text-[#E86A3A]">★</span> {data.averageRating.toFixed(1)}
                </span>
                {data.reviewsCount != null && data.reviewsCount > 0 && (
                  <>
                    <span className="font-mono text-[13px] text-[rgba(20,18,16,0.55)]">· </span>
                    <a
                      href="#reviews"
                      className="font-mono text-[13px] text-[rgba(20,18,16,0.55)] transition-colors hover:text-[#141210]"
                      style={{ textDecoration: "underline", textDecorationStyle: "dashed", textDecorationColor: "#E86A3A", textUnderlineOffset: "3px" }}
                    >
                      {pluralReviews(data.reviewsCount)}
                    </a>
                  </>
                )}
              </div>
            ) : <span />}
            <SidebarCardShare title={data.title} />
          </div>
        </SidebarCardTopSection>
      </SidebarCard>

      {/* ── Trust badge ── */}
      <div className="mt-4 flex items-center gap-3 px-4 text-[12px] text-[rgba(20,18,16,0.55)]">
        <span className="relative inline-flex h-2 w-2 shrink-0 rounded-full bg-[#2FBF71] shadow-[0_0_0_4px_rgba(47,191,113,0.18)]" />
        Подтверждённый партнёр mamaGo
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
