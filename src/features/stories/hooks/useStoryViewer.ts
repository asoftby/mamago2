"use client";

import { useState, useCallback, useEffect } from "react";
import type { StoryCollection } from "../types/story";

export function useStoryViewer(stories: StoryCollection[]) {
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("mamago.stories.seen");
      if (raw) return new Set<string>(JSON.parse(raw));
    } catch {}
    return new Set();
  });
  const [paused, setPaused] = useState(false);
  // Incremented on every manual nav to reset the CSS animation
  const [progressKey, setProgressKey] = useState(0);

  const isOpen = activeStoryIndex !== null;
  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  // ── helpers ──────────────────────────────────────────────────────────────

  const markSeen = useCallback((index: number) => {
    const story = stories[index];
    if (!story) return;
    setSeenIds((prev) => {
      const next = new Set(prev).add(story.id);
      try { localStorage.setItem("mamago.stories.seen", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [stories]);

  const open = useCallback((storyIndex: number) => {
    setActiveStoryIndex(storyIndex);
    setActiveItemIndex(0);
    setProgressKey((k) => k + 1);
    markSeen(storyIndex);
  }, [markSeen]);

  const close = useCallback(() => {
    setActiveStoryIndex(null);
    setActiveItemIndex(0);
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
      setActiveStoryIndex(nextStoryIndex);
      setActiveItemIndex(0);
      markSeen(nextStoryIndex);
    } else {
      close();
    }
  }, [activeStoryIndex, activeStory, activeItemIndex, stories, close, markSeen]);

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
      setActiveStoryIndex(prevStoryIndex);
      setActiveItemIndex(prevStory.items.length - 1);
    }
  }, [activeStoryIndex, activeStory, activeItemIndex, stories]);

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
    progressKey,
    paused,
    open,
    close,
    next,
    prev,
    pause,
    resume,
  };
}
