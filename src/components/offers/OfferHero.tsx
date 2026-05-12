"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Play, MapPin, Heart, Share2, Check, X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { Button } from "@/components/ui/button";

interface OfferHeroProps {
  data: OfferPageData;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isInPlan?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onSave: () => void;
}

/**
 * Hero-зона страницы предложения (Premium Style)
 */
export function OfferHero({
  data,
  isPrimaryLoading,
  isSecondaryLoading,
  isInPlan,
  onPrimary,
  onSecondary,
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
      case "CAMP": return "Лагерь";
      case "REGULAR": return "Занятия";
      case "SINGLE": return "Событие";
      default: return "Предложение";
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
      } catch { return url; }
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
    <section className="space-y-6 lg:space-y-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-gray-400">
        <a href="/" className="hover:text-gray-700 transition-colors">Главная</a>
        <span aria-hidden="true">/</span>
        <a href={`/${data.citySlug}/offers`} className="hover:text-gray-700 transition-colors">
          {badgeLabel}
        </a>
        {data.place && (
          <>
            <span aria-hidden="true">/</span>
            <a href={`/places/${data.place.slug}`} className="hover:text-gray-700 transition-colors truncate max-w-[160px]">
              {data.place.name}
            </a>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-gray-600 font-medium truncate max-w-[200px]">{data.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_440px] lg:gap-10 xl:gap-14">
        <div className="space-y-3">
          <button
            type="button"
            className="group relative w-full aspect-[4/3] overflow-hidden rounded-3xl bg-neutral-100 shadow-sm cursor-pointer"
            onClick={() => {
              if (hasGallery) openGallery(0);
              else if (hasVideo) openVideo();
            }}
          >
            {hasCover ? (
              <Image
                src={data.media.posterUrl}
                alt={data.media.posterAlt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                priority
                sizes="(max-width: 1024px) 100vw, 700px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
                <ImageIcon className="h-16 w-16 text-neutral-300" />
              </div>
            )}
            {hasVideo && !hasGallery && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/25">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-2xl transition-transform group-hover:scale-110">
                  <Play className="h-8 w-8 fill-[#EF8759] text-[#EF8759] ml-1" />
                </div>
              </div>
            )}
          </button>

          {(hasGallery || hasVideo) && (
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
              {hasVideo && (
                <button
                  type="button"
                  onClick={openVideo}
                  className="relative h-[72px] w-[100px] shrink-0 overflow-hidden rounded-2xl bg-neutral-100 ring-2 ring-transparent transition-all hover:ring-[#EF8759]/60"
                >
                  {hasCover && (
                    <Image src={data.media.posterUrl} alt="Видео" fill className="object-cover" sizes="100px" />
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
                    className="relative h-[72px] w-[100px] shrink-0 overflow-hidden rounded-2xl bg-neutral-100 ring-2 ring-transparent transition-all hover:ring-[#EF8759]/60"
                  >
                    <Image src={img.url} alt={img.alt || ""} fill className="object-cover" sizes="100px" />
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

        <div className="flex flex-col gap-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#EF8759]">
            {badgeLabel}
          </p>
          <h1 className="text-[28px] font-bold leading-[1.2] tracking-tight text-gray-900 lg:text-[32px] xl:text-[36px]">
            {data.title}
          </h1>
          {data.place && (
            <div className="space-y-0.5">
              <a href={`/places/${data.place.slug}`} className="flex items-center gap-1.5 text-[15px] font-semibold text-gray-800 hover:text-[#EF8759] transition-colors">
                <MapPin className="h-4 w-4 shrink-0 text-[#EF8759]" />
                {data.place.name}
              </a>
              {data.place.address && (
                <p className="pl-[22px] text-[13px] text-gray-500">{data.place.address}</p>
              )}
            </div>
          )}
          {data.shortDescription && (
            <p className="text-[15px] leading-[1.65] text-gray-600">
              {data.shortDescription}
            </p>
          )}
          {data.metaGrid.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.metaGrid.slice(0, 5).map((item) => (
                <span key={item.id} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[13px] font-medium text-gray-600">
                  {item.value}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto space-y-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            {(data.pricing.priceFrom || data.pricing.singlePrice) && (
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Стоимость</p>
                  <p className="text-[26px] font-bold text-gray-900">
                    {data.pricing.priceFrom || data.pricing.singlePrice}
                  </p>
                </div>
                {data.pricing.promotionText && (
                  <span className="rounded-xl bg-[#FFF7F3] px-3 py-1 text-[12px] font-bold text-[#EF8759]">
                    {data.pricing.promotionText}
                  </span>
                )}
              </div>
            )}
            <Button
              onClick={onPrimary}
              disabled={isPrimaryLoading}
              className="h-[52px] w-full rounded-2xl bg-[#EF8759] text-[15px] font-bold text-white shadow-md shadow-[#EF8759]/25 hover:bg-[#e07848] transition-all"
            >
              {isPrimaryLoading ? "Загрузка..." : data.cta.primaryLabel}
            </Button>
            {data.cta.secondaryLabel && (
              <Button
                variant="outline"
                onClick={onSecondary}
                disabled={isSecondaryLoading}
                className={cn(
                  "h-[52px] w-full rounded-2xl text-[15px] font-bold transition-all",
                  isInPlan
                    ? "border-[#EF8759] bg-[#FFF7F3] text-[#EF8759]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                {isInPlan ? (
                  <><Check className="mr-2 h-4 w-4" />В плане</>
                ) : (
                  <><Heart className="mr-2 h-4 w-4" />{data.cta.secondaryLabel}</>
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-center gap-6">
            <button type="button" onClick={onSave} className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-800">
              <Heart className={cn("h-4 w-4", isInPlan && "fill-[#EF8759] text-[#EF8759]")} />
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator.share({ title: data.title, url: window.location.href });
                }
              }}
              className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-800"
            >
              <Share2 className="h-4 w-4" />
              Поделиться
            </button>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-8"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-5 right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxMode === "video" && data.media.videoUrl ? (
            <div className="relative w-full max-w-5xl aspect-video" onClick={(e) => e.stopPropagation()}>
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
                  className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              <div className="relative w-full max-w-5xl aspect-[4/3]" onClick={(e) => e.stopPropagation()}>
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
                  className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
                {galleryIndex + 1} / {gallery.length}
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
