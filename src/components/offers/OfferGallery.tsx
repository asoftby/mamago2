"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { OfferGalleryImage } from "@/lib/offer/offerPageTypes";

interface OfferGalleryProps {
  images: OfferGalleryImage[];
}

const VISIBLE_COUNT = 5;

/**
 * Photo Gallery Block
 * Desktop: 5 равных карточек в ряд, последняя с overlay "+N"
 * Mobile: horizontal scroll
 * Lightbox с навигацией
 */
export function OfferGallery({ images }: OfferGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const visibleImages = images.slice(0, VISIBLE_COUNT);
  const hiddenCount = images.length - VISIBLE_COUNT;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const nextImage = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % images.length);
  };
  const prevImage = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
  };

  return (
    <>
      <section className="space-y-5">
        <h2 className="text-[22px] font-bold text-gray-900 lg:text-[24px]">Фотогалерея</h2>

        {/* Desktop: 5 columns */}
        <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {visibleImages.map((image, index) => {
            const isLast = index === VISIBLE_COUNT - 1 && hiddenCount > 0;
            return (
              <button
                key={image.id}
                type="button"
                aria-label={`Фото ${index + 1}`}
                onClick={() => openLightbox(index)}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]"
              >
                <Image
                  src={image.url}
                  alt={image.alt || `Фото ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
                {/* +N overlay */}
                {isLast && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                    <span className="text-[22px] font-bold text-white">+{hiddenCount}</span>
                  </div>
                )}
                {/* Hover overlay */}
                {!isLast && (
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile: horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-3 sm:hidden snap-x snap-mandatory scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Фото ${index + 1}`}
              onClick={() => openLightbox(index)}
              className="snap-start shrink-0 relative w-[220px] aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100"
            >
              <Image
                src={image.url}
                alt={image.alt || `Фото ${index + 1}`}
                fill
                className="object-cover"
                sizes="220px"
              />
            </button>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фотографии"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            type="button"
            aria-label="Закрыть"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              type="button"
              aria-label="Предыдущее фото"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative w-full max-w-5xl aspect-[4/3]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[lightboxIndex]!.url}
              alt={images[lightboxIndex]!.alt || `Фото ${lightboxIndex + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>

          {/* Next */}
          {images.length > 1 && (
            <button
              type="button"
              aria-label="Следующее фото"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
