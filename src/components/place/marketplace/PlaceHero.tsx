"use client";

import { Share2, Heart, MapPin, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { OwnerPlaceEditDropdown } from "./OwnerPlaceEditDropdown";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";

interface PlaceHeroProps {
  title: string;
  address?: string;
  shortDesc: string;
  categoryLabel?: string;
  logoUrl?: string | null;
  coverImageUrl?: string;
  images?: Array<{
    id: string;
    url: string;
    alt?: string;
  }>;
  onShareClick?: () => void;
  onSaveClick?: () => void;
  /** Когда задан — показываем дропдаун «Редактировать» (владелец / команда / админ). */
  ownerEditPlaceId?: string;
}

export function PlaceHero({
  title,
  address,
  shortDesc,
  categoryLabel,
  logoUrl,
  coverImageUrl,
  images = [],
  onShareClick,
  onSaveClick,
  ownerEditPlaceId,
}: PlaceHeroProps) {
  const displayCover = coverImageUrl || images[0]?.url;
  const totalImages = images.length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
      {/* Left: Cover Image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gray-100">
        {displayCover ? (
          isAppMediaUrl(displayCover) ? (
            <img
              src={displayCover}
              alt={title}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Image
              src={displayCover}
              alt={title}
              fill
              priority
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <ImageIcon className="h-16 w-16 text-gray-400" />
          </div>
        )}

        {/* Лого: показываем бейдж всегда, если есть URL (даже если совпадает с обложкой — это намеренный акцент) */}
        {logoUrl ? (
          <div className="absolute bottom-4 left-4 z-10 rounded-2xl border-2 border-white bg-white p-2 shadow-lg">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl">
              {isAppMediaUrl(logoUrl) ? (
                <img
                  src={logoUrl}
                  alt={`${title} logo`}
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={logoUrl}
                  alt={`${title} logo`}
                  fill
                  className="object-cover"
                />
              )}
            </div>
          </div>
        ) : null}

        {/* All Photos Button - Bottom Right */}
        {totalImages > 0 && (
          <Link
            href={`#photos`}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/30 bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
          >
            <ImageIcon className="h-4 w-4" />
            Все фото ({totalImages})
          </Link>
        )}
      </div>

      {/* Right: Info */}
      <div className="flex flex-col justify-center space-y-4">
        {categoryLabel && (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#EF8759]">
            {categoryLabel}
          </p>
        )}
        <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">
          {title}
        </h1>

        {address && (
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#EF8759]" />
            <span className="text-base">{address}</span>
          </div>
        )}

        {shortDesc && (
          <p className="text-base leading-relaxed text-gray-700">
            {shortDesc}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            size="lg"
            onClick={onShareClick}
            className="flex-1 gap-2"
          >
            <Share2 className="h-4 w-4" />
            Поделиться
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onSaveClick}
            className="flex-1 gap-2"
          >
            <Heart className="h-4 w-4" />
            Сохранить
          </Button>
        </div>
        {ownerEditPlaceId ? (
          <div className="pt-1">
            <OwnerPlaceEditDropdown placeId={ownerEditPlaceId} className="w-full" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
