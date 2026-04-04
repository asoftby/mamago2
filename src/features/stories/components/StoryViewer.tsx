"use client";

import { useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryProgress } from "./StoryProgress";
import { StoryViewerCard } from "./StoryViewerCard";
import type { StoryCollection } from "../types/story";

interface StoryViewerProps {
  stories: StoryCollection[];
  activeStory: StoryCollection;
  activeStoryIndex: number;
  activeItemIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function StoryViewer({
  stories,
  activeStory,
  activeStoryIndex,
  activeItemIndex,
  onNext,
  onPrev,
  onClose,
}: StoryViewerProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;

      // Swipe down to close
      if (dy > 60 && Math.abs(dy) > Math.abs(dx)) {
        onClose();
        return;
      }

      touchStartX.current = null;
      touchStartY.current = null;
    },
    [onClose],
  );

  const handleTapZone = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width * 0.35) {
        onPrev();
      } else {
        onNext();
      }
    },
    [onNext, onPrev],
  );

  const currentItem = activeStory.items[activeItemIndex];
  if (!currentItem) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Story card */}
      <div className="relative w-full h-full">
        <StoryViewerCard
          item={currentItem}
          storyTitle={activeStory.title}
        />

        {/* Tap zones (above the card content) */}
        <div
          className="absolute inset-0 z-20"
          onClick={handleTapZone}
          style={{ bottom: "140px" }} // leave CTA area untouched
        />

        {/* Progress + header */}
        <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
          <StoryProgress
            total={activeStory.items.length}
            current={activeItemIndex}
            progressKey={activeItemIndex}
            paused={false}
          />

          {/* Story title + close */}
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <div className="flex items-center gap-2">
              {activeStory.emoji && (
                <span className="text-lg leading-none">{activeStory.emoji}</span>
              )}
              <span className="text-sm font-semibold text-white drop-shadow">
                {activeStory.title}
              </span>
              <span className="text-xs text-white/50">
                {activeItemIndex + 1} / {activeStory.items.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="pointer-events-auto h-8 w-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Desktop prev/next arrows */}
        <button
          onClick={onPrev}
          className={cn(
            "hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30",
            "h-10 w-10 items-center justify-center rounded-full",
            "bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors",
            activeStoryIndex === 0 && activeItemIndex === 0 && "opacity-30 pointer-events-none",
          )}
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onNext}
          className={cn(
            "hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30",
            "h-10 w-10 items-center justify-center rounded-full",
            "bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors",
          )}
          aria-label="Вперёд"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
