"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryProgress } from "./StoryProgress";
import type { StoryCollection, StoryItem } from "../types/story";

interface StoryModalVisualProps {
  story: StoryCollection;
  currentItem: StoryItem;
  prevItem: StoryItem | null;
  nextItem: StoryItem | null;
  activeItemIndex: number;
  progressKey: number;
  paused: boolean;
  onNext: () => void;
  onPrev: () => void;
  onProgressComplete: () => void;
}

export function StoryModalVisual({
  story,
  currentItem,
  prevItem,
  nextItem,
  activeItemIndex,
  progressKey,
  paused,
  onNext,
  onPrev,
  onProgressComplete,
}: StoryModalVisualProps) {
  const isFirst = !prevItem && activeItemIndex === 0;
  const imgKey = `${currentItem.id}-${currentItem.image}`;
  const [prevImgKey, setPrevImgKey] = useState(imgKey);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset image state when item changes
  if (imgKey !== prevImgKey) {
    setPrevImgKey(imgKey);
    setImgLoaded(false);
    setImgError(false);
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral-950 select-none">

      {/* ── Skeleton / placeholder while loading ── */}
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 z-[1] bg-neutral-900 animate-pulse" />
      )}

      {/* ── Error fallback ── */}
      {imgError && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-neutral-900">
          <ImageOff className="h-8 w-8 text-neutral-600" />
          <p className="text-xs text-neutral-500">Изображение не загрузилось</p>
        </div>
      )}

      {/* ── Main image ── */}
      {currentItem.image && !imgError && (
        <Image
          key={imgKey}
          src={currentItem.image}
          alt={currentItem.title}
          fill
          className={cn("object-cover transition-opacity duration-300", imgLoaded ? "opacity-100" : "opacity-0")}
          sizes="(max-width: 768px) 100vw, 500px"
          quality={90}
          priority
          onLoad={() => setImgLoaded(true)}
          onError={() => { setImgLoaded(false); setImgError(true); }}
        />
      )}

      {/* ── Top gradient ── */}
      <div className="absolute inset-x-0 top-0 h-28 z-[2] bg-gradient-to-b from-black/60 via-black/15 to-transparent pointer-events-none" />

      {/* ── Bottom gradient ── */}
      <div className="absolute inset-x-0 bottom-0 h-20 z-[2] bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

      {/* ── Progress bar ── */}
      <div className="absolute inset-x-0 top-0 z-[5] pt-3 px-3">
        <StoryProgress
          total={story.items.length}
          current={activeItemIndex}
          progressKey={progressKey}
          paused={paused}
          onComplete={onProgressComplete}
        />
      </div>



      {/* ── Invisible nav zones ── */}
      <div className="absolute inset-0 z-[6] flex" style={{ top: "72px" }}>
        <div className="w-[40%] h-full cursor-pointer" onClick={onPrev} />
        <div className="flex-1 h-full cursor-pointer" onClick={onNext} />
      </div>

      {/* ── Nav arrows ── */}
      <button
        onClick={onPrev}
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 z-[7]",
          "h-9 w-9 flex items-center justify-center rounded-full",
          "bg-black/30 backdrop-blur-sm text-white border border-white/10",
          "hover:bg-black/50 transition-all",
          isFirst && "opacity-0 pointer-events-none",
        )}
        aria-label="Назад"
        tabIndex={isFirst ? -1 : 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        onClick={onNext}
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 z-[7]",
          "h-9 w-9 flex items-center justify-center rounded-full",
          "bg-black/30 backdrop-blur-sm text-white border border-white/10",
          "hover:bg-black/50 transition-all",
          !nextItem && "opacity-40",
        )}
        aria-label="Вперёд"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* ── Mobile: item title at bottom ── */}
      <div className="absolute inset-x-0 bottom-0 z-[5] px-5 pb-4 md:hidden pointer-events-none">
        <p className="text-sm font-semibold text-white leading-snug drop-shadow line-clamp-2">
          {currentItem.title}
        </p>
      </div>
    </div>
  );
}
