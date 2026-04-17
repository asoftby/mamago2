"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalCloseButton } from "@/components/ui/modal-close-button";

interface PlaceGalleryLightboxProps {
  images: Array<{
    id: string;
    url: string;
    alt?: string;
  }>;
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function PlaceGalleryLightbox({
  images,
  initialIndex,
  isOpen,
  onClose,
}: PlaceGalleryLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, goToNext, goToPrevious, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <ModalCloseButton
        onClick={onClose}
        className="absolute top-4 right-4 z-10"
      />

      {/* Counter */}
      {hasMultiple && (
        <div className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full bg-black/50 text-white text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            onClick={goToPrevious}
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 z-10",
              "p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors",
              "hidden md:block"
            )}
            aria-label="Предыдущее фото"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            onClick={goToNext}
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 z-10",
              "p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors",
              "hidden md:block"
            )}
            aria-label="Следующее фото"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Image container - click to close */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4 md:p-8"
        onClick={onClose}
      >
        <img
          src={currentImage.url}
          alt={currentImage.alt || `Фото ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
        />
      </div>

      {/* Mobile swipe zones */}
      {hasMultiple && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-1/3 md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-1/3 md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          />
        </>
      )}
    </div>
  );
}
