"use client";

import { useState, useCallback, useEffect } from "react";
import type { StoryCollection } from "../types/story";
import {
  markSeen as addSeenOfferId,
  orderBySeen,
  readSeen,
  seenGroupStart as resolveSeenGroupStart,
  writeSeen,
} from "../lib/seen";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useStoryViewer(stories: StoryCollection[]) {
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeItems, setActiveItems] = useState<StoryCollection["items"]>([]);
  const [seenGroupStart, setSeenGroupStart] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  // Incremented on every manual nav to reset the CSS animation
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSeenIds(readSeen(browserStorage()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isOpen = activeStoryIndex !== null;
  const activeSourceStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;
  const activeStory = activeSourceStory
    ? { ...activeSourceStory, items: activeItems }
    : null;

  // ── helpers ──────────────────────────────────────────────────────────────

  const markSeen = useCallback((offerId: string) => {
    setSeenIds((prev) => {
      const next = addSeenOfferId(prev, offerId);
      if (next === prev) return prev;
      writeSeen(browserStorage(), next);
      return next;
    });
  }, []);

  const open = useCallback(
    (storyIndex: number) => {
      const story = stories[storyIndex];
      if (!story) return;
      setActiveItems(orderBySeen(story.items, seenIds));
      setSeenGroupStart(resolveSeenGroupStart(story.items, seenIds));
      setActiveStoryIndex(storyIndex);
      setActiveItemIndex(0);
      setProgressKey((k) => k + 1);
    },
    [seenIds, stories],
  );

  const close = useCallback(() => {
    setActiveStoryIndex(null);
    setActiveItemIndex(0);
    setActiveItems([]);
    setSeenGroupStart(null);
  }, []);

  const next = useCallback(() => {
    if (activeStoryIndex === null || !activeStory) return;
    setProgressKey((k) => k + 1);

    const isLastItem = activeItemIndex >= activeStory.items.length - 1;
    if (!isLastItem) {
      setActiveItemIndex((i) => i + 1);
      return;
    }
    const nextStoryIndex = activeStoryIndex + 1;
    if (nextStoryIndex < stories.length) {
      setActiveItems(orderBySeen(stories[nextStoryIndex].items, seenIds));
      setSeenGroupStart(resolveSeenGroupStart(stories[nextStoryIndex].items, seenIds));
      setActiveStoryIndex(nextStoryIndex);
      setActiveItemIndex(0);
    } else {
      close();
    }
  }, [activeStoryIndex, activeStory, activeItemIndex, stories, seenIds, close]);

  const prev = useCallback(() => {
    if (activeStoryIndex === null || !activeStory) return;
    setProgressKey((k) => k + 1);

    if (activeItemIndex > 0) {
      setActiveItemIndex((i) => i - 1);
      return;
    }
    const prevStoryIndex = activeStoryIndex - 1;
    if (prevStoryIndex >= 0) {
      const prevStory = stories[prevStoryIndex];
      const orderedItems = orderBySeen(prevStory.items, seenIds);
      setActiveItems(orderedItems);
      setSeenGroupStart(resolveSeenGroupStart(prevStory.items, seenIds));
      setActiveStoryIndex(prevStoryIndex);
      setActiveItemIndex(orderedItems.length - 1);
    }
  }, [activeStoryIndex, activeStory, activeItemIndex, stories, seenIds]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  // ── keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, next, prev, close]);

  return {
    isOpen,
    activeStory,
    activeStoryIndex,
    activeItemIndex,
    seenIds,
    seenGroupStart,
    progressKey,
    paused,
    open,
    close,
    next,
    prev,
    pause,
    resume,
    markSeen,
  };
}
