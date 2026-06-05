"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PlaceGalleryProps {
  images: Array<{
    id: string;
    url: string;
    alt?: string;
  }>;
}

export function PlaceGallery({ images }: PlaceGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  const displayImages = images.slice(0, 5);
  const hasMore = images.length > 5;

  const openGallery = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-4 gap-2 h-[400px] sm:h-[500px] rounded-2xl overflow-hidden">
          {/* Main large image */}
          <div
            className="col-span-4 sm:col-span-2 row-span-2 relative cursor-pointer group"
            onClick={() => openGallery(0)}
          >
            <Image
              src={displayImages[0].url}
              alt={displayImages[0].alt || "Place photo"}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 50vw"
              priority
              unoptimized={isAppMediaUrl(displayImages[0].url)}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>

          {/* Four smaller images */}
          {displayImages.slice(1, 5).map((image, index) => (
            <div
              key={image.id}
              className="col-span-2 sm:col-span-1 relative cursor-pointer group"
              onClick={() => openGallery(index + 1)}
            >
              <Image
                src={image.url}
                alt={image.alt || `Place photo ${index + 2}`}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, 25vw"
                unoptimized={isAppMediaUrl(image.url)}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              
              {/* "Show all photos" overlay on last image */}
              {index === 3 && hasMore && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Button
                    variant="secondary"
                    className="bg-white hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGallery(0);
                    }}
                  >
                    Показать все фото ({images.length})
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Gallery Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black">
          <div className="relative w-full h-[95vh] flex items-center justify-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Counter */}
            <div className="absolute top-4 left-4 z-50 text-white bg-black/50 px-4 py-2 rounded-full text-sm font-medium">
              {currentIndex + 1} / {images.length}
            </div>

            {/* Previous button */}
            {images.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 z-50 text-white hover:bg-white/20 w-12 h-12"
                onClick={prevImage}
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
            )}

            {/* Current image */}
            <div className="relative w-full h-full flex items-center justify-center p-12">
              <Image
                src={images[currentIndex].url}
                alt={images[currentIndex].alt || `Photo ${currentIndex + 1}`}
                fill
                className="object-contain"
                sizes="95vw"
                unoptimized={isAppMediaUrl(images[currentIndex].url)}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>

            {/* Next button */}
            {images.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 z-50 text-white hover:bg-white/20 w-12 h-12"
                onClick={nextImage}
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
