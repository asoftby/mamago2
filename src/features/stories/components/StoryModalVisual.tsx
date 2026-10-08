"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryProgress } from "./StoryProgress";
import type { StoryCollection, StoryItem } from "../types/story";

const LONG_PRESS_MS = 220;

/**
 * Mobile tap zone: a quick tap navigates (onTap), a press-and-hold pauses
 * autoplay for as long as it's held (onPause/onResume) without navigating.
 */
function StoryTapZone({
  className,
  onTap,
  onPause,
  onResume,
  label,
}: {
  className?: string;
  onTap: () => void;
  onPause: () => void;
  onResume: () => void;
  label: string;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engaged = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handlePointerDown = useCallback(() => {
    engaged.current = false;
    holdTimer.current = setTimeout(() => {
      engaged.current = true;
      onPause();
    }, LONG_PRESS_MS);
  }, [onPause]);

  const release = useCallback(() => {
    clearHoldTimer();
    if (engaged.current) {
      onResume();
    } else {
      onTap();
    }
    engaged.current = false;
  }, [onResume, onTap]);

  const cancel = useCallback(() => {
    clearHoldTimer();
    if (engaged.current) onResume();
    engaged.current = false;
  }, [onResume]);

  useEffect(() => clearHoldTimer, []);

  return (
    <button
      type="button"
      className={cn("cursor-pointer", className)}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      aria-label={label}
    />
  );
}

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
  onPause: () => void;
  onResume: () => void;
  onTogglePause: () => void;
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
  onPause,
  onResume,
  onTogglePause,
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
      {currentItem.image && !imgLoaded && !imgError && (
        <div className="absolute inset-0 z-[1] bg-neutral-900 animate-pulse" />
      )}

      {/* ── Error fallback ── */}
      {imgError && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-neutral-900">
          <ImageOff className="h-8 w-8 text-neutral-600" />
          <p className="text-xs text-neutral-500">Изображение не загрузилось</p>
        </div>
      )}

      {/* ── No cover at all → gradient fallback, zone never collapses ── */}
      {!currentItem.image && !imgError && (
        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
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

      {/* ── Preload the next cover — same sizes/quality so the browser reuses
          this fetch instead of re-requesting when it becomes current ── */}
      {nextItem?.image && (
        <div className="absolute h-px w-px overflow-hidden opacity-0" aria-hidden>
          <Image
            key={`${nextItem.id}-${nextItem.image}`}
            src={nextItem.image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 500px"
            quality={90}
          />
        </div>
      )}

      {/* ── Top gradient ── */}
      <div className="absolute inset-x-0 top-0 h-28 z-[2] bg-gradient-to-b from-black/60 via-black/15 to-transparent pointer-events-none" />

      {/* ── Bottom gradient ── */}
      <div className="absolute inset-x-0 bottom-0 h-20 z-[2] bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

      {/* ── Progress bar ── */}
      <div
        className={cn(
          "absolute inset-x-0 z-[5]",
          "md:top-0 md:pt-3",
          // Mobile: clear the notch/dynamic island
          "max-md:top-[calc(env(safe-area-inset-top)+8px)]",
        )}
      >
        <StoryProgress
          total={story.items.length}
          current={activeItemIndex}
          progressKey={progressKey}
          paused={paused}
          onComplete={onProgressComplete}
        />
      </div>

      {/* ── Desktop: click anywhere over the cover to pause / resume ── */}
      <button
        type="button"
        className="hidden md:block absolute inset-x-0 bottom-0 top-[72px] z-[6] cursor-pointer"
        onClick={onTogglePause}
        aria-label={paused ? "Продолжить сторис" : "Поставить сторис на паузу"}
        aria-pressed={paused}
      />

      {/* ── Mobile: left/right tap zones — tap navigates, long-press pauses ── */}
      <div className="md:hidden absolute inset-x-0 bottom-0 top-[72px] z-[6] flex">
        <StoryTapZone
          className="h-full w-[35%]"
          onTap={onPrev}
          onPause={onPause}
          onResume={onResume}
          label="Назад"
        />
        <StoryTapZone
          className="h-full flex-1"
          onTap={onNext}
          onPause={onPause}
          onResume={onResume}
          label="Вперёд"
        />
      </div>

      {/* ── Nav arrows ── */}
      <button
        onClick={onPrev}
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 z-[7]",
          "h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-full",
          "bg-black/30 backdrop-blur-sm text-white border border-white/10",
          "hover:bg-black/50 transition-all",
          isFirst && "opacity-0 pointer-events-none",
        )}
        aria-label="Назад"
        tabIndex={isFirst ? -1 : 0}
      >
        <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
      </button>

      <button
        onClick={onNext}
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 z-[7]",
          "h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-full",
          "bg-black/30 backdrop-blur-sm text-white border border-white/10",
          "hover:bg-black/50 transition-all",
          !nextItem && "opacity-40",
        )}
        aria-label="Вперёд"
      >
        <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
      </button>
    </div>
  );
}
