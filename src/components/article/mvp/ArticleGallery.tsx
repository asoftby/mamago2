"use client";

import { useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import {
  LEGACY_ARTICLE_GALLERY_PRESENTATION,
  type ArticleGalleryPresentation,
} from "@/lib/publications/articleMvp";

export type ArticleGalleryImage = {
  id: string;
  url: string | null;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
};

function GalleryImage({ image, sizes, fit = "cover" }: {
  image: ArticleGalleryImage;
  sizes: string;
  fit?: "cover" | "contain";
}) {
  if (!image.url) {
    return <div className="absolute inset-0 bg-muted/30" aria-label="Изображение недоступно" />;
  }
  return (
    <Image
      src={image.url}
      alt={image.alt ?? ""}
      fill
      sizes={sizes}
      className={fit === "contain" ? "object-contain" : "object-cover"}
      unoptimized={isAppMediaUrl(image.url)}
    />
  );
}

function ItemCaption({ caption }: { caption: string | null }) {
  return caption ? <figcaption className="mt-2 px-1 text-sm text-muted-foreground">{caption}</figcaption> : null;
}

export function ArticleGallery({ images, presentation = LEGACY_ARTICLE_GALLERY_PRESENTATION, caption }: {
  images: ArticleGalleryImage[];
  presentation?: ArticleGalleryPresentation;
  caption?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  if (images.length === 0) return null;

  const scroll = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * railRef.current.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="not-prose my-8 min-w-0 md:my-10" data-gallery-presentation={presentation}>
      {presentation === "carousel" ? (
        <div className="relative">
          <div ref={railRef} className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="list" aria-label="Карусель изображений">
            {images.map((image) => (
              <figure key={image.id} className="w-full shrink-0 snap-center" role="listitem">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                  <GalleryImage image={image} sizes="(max-width: 767px) 100vw, 720px" fit="contain" />
                </div>
                <ItemCaption caption={image.caption} />
              </figure>
            ))}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Проведите в сторону или используйте кнопки</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => scroll(-1)} aria-label="Предыдущее изображение"><ChevronLeft className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" size="icon" onClick={() => scroll(1)} aria-label="Следующее изображение"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : presentation === "sequential" ? (
        <div className="space-y-6" role="list" aria-label="Изображения по порядку">
          {images.map((image) => {
            const aspectRatio = image.width && image.height ? `${image.width} / ${image.height}` : "4 / 3";
            return (
              <figure key={image.id} role="listitem">
                <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20" style={{ aspectRatio }}>
                  <GalleryImage image={image} sizes="(max-width: 767px) 100vw, 720px" fit="contain" />
                </div>
                <ItemCaption caption={image.caption} />
              </figure>
            );
          })}
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-2", images.length === 1 && "grid-cols-1", images.length >= 3 && "md:grid-cols-3")} role="list" aria-label="Мозаика изображений">
          {images.map((image, index) => (
            <figure key={image.id} className={cn("min-w-0", images.length === 3 && index === 0 && "col-span-2 md:col-span-2 md:row-span-2")} role="listitem">
              <div className={cn("relative w-full overflow-hidden rounded-lg border border-border/50 bg-muted/20", images.length === 3 && index === 0 ? "aspect-[2/1] md:aspect-auto md:h-full" : "aspect-square")}>
                <GalleryImage image={image} sizes="(max-width: 767px) 50vw, 240px" />
              </div>
              <ItemCaption caption={image.caption} />
            </figure>
          ))}
        </div>
      )}
      {caption ? <p className="mt-3 px-1 text-center text-sm text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
