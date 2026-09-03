"use client";

import { useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { StoryModalVisual } from "./StoryModalVisual";
import { StoryModalActionCard } from "./StoryModalActionCard";
import type { StoryCollection } from "../types/story";

interface StoryModalProps {
  activeStory: StoryCollection;
  activeStoryIndex: number;
  activeItemIndex: number;
  totalStories: number;
  progressKey: number;
  paused: boolean;
  seenOfferIds: ReadonlySet<string>;
  seenGroupStart: number | null;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onItemShown: (offerId: string) => void;
}

export function StoryModal({
  activeStory,
  activeItemIndex,
  progressKey,
  paused,
  seenGroupStart,
  onNext,
  onPrev,
  onClose,
  onPause,
  onResume,
  onItemShown,
}: StoryModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const currentItem = activeStory.items[activeItemIndex];
  const prevItem = activeItemIndex > 0 ? activeStory.items[activeItemIndex - 1] : null;
  const nextItem = activeItemIndex < activeStory.items.length - 1
    ? activeStory.items[activeItemIndex + 1]
    : null;

  // Mounting the active modal card is the point at which it was actually shown.
  useEffect(() => {
    onItemShown(currentItem?.offerId ?? "");
  }, [currentItem?.offerId, onItemShown]);

  // ── scroll lock ───────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── close on backdrop click ───────────────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  const handleTogglePause = useCallback(() => {
    if (paused) onResume();
    else onPause();
  }, [onPause, onResume, paused]);

  // ── mobile: swipe down → close ───────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null || touchStartX.current === null) return;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (dy > 72 && Math.abs(dy) > Math.abs(dx)) onClose();
      touchStartX.current = null;
      touchStartY.current = null;
    },
    [onClose],
  );

  if (!currentItem) return null;

  return (
    /* ── Backdrop ── */
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(10,10,10,0.72)", backdropFilter: "blur(10px)" }}
      onClick={handleBackdropClick}
    >
      {/* ── Close button — floating outside modal ── */}
      <ModalCloseButton
        onClick={onClose}
        className={cn(
          "absolute z-[60]",
          "md:top-6 md:right-6",
          "top-4 right-4",
        )}
      />

      {/* ── Modal shell ── */}
      <div
        className={cn(
          "relative overflow-hidden bg-white shadow-2xl",
          // Desktop: 2-column, fixed size
          "md:flex md:rounded-3xl md:max-w-[780px] md:w-full md:h-[560px] md:mx-8",
          // Mobile: full screen sheet
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-3xl max-md:flex max-md:flex-col",
          "max-md:max-h-[92dvh]",
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          // Pause on hover only on pointer devices (desktop), not on touch
          if (window.matchMedia("(pointer: fine)").matches) onPause();
        }}
        onMouseLeave={() => {
          if (window.matchMedia("(pointer: fine)").matches) onResume();
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ══ LEFT / TOP: Visual panel ══════════════════════════════════════ */}
        <div
          className={cn(
            "relative shrink-0 overflow-hidden bg-neutral-950",
            // Desktop: left column
            "md:w-[52%] md:h-full",
            // Mobile: top area
            "max-md:h-[52vw] max-md:min-h-[220px] max-md:max-h-[300px]",
          )}
        >
          <StoryModalVisual
            story={activeStory}
            currentItem={currentItem}
            prevItem={prevItem}
            nextItem={nextItem}
            activeItemIndex={activeItemIndex}
            progressKey={progressKey}
            paused={paused}
            onNext={onNext}
            onPrev={onPrev}
            onTogglePause={handleTogglePause}
            onProgressComplete={onNext}
          />
        </div>

        {/* ══ RIGHT / BOTTOM: Action card ═══════════════════════════════════ */}
        <div
          className={cn(
            "bg-white",
            "md:flex-1 md:overflow-y-auto",
            "max-md:flex-1 max-md:overflow-y-auto",
          )}
        >
          {seenGroupStart === activeItemIndex && (
            <div data-testid="stories-seen-divider" className="mx-5 border-t border-neutral-200" />
          )}
          <StoryModalActionCard
            item={currentItem}
            storyTitle={activeStory.title}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
