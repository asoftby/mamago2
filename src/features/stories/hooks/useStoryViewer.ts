"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { StoryCollection } from "../types/story";
import {
  markSeen as addSeenOfferId,
  orderBySeen,
  unseenCount,
  readSeen,
  seenGroupStart as resolveSeenGroupStart,
  writeSeen,
  readSeenBreakingNews,
  markBreakingNewsSeen,
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
  const [sessionStories, setSessionStories] = useState<StoryCollection[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeItems, setActiveItems] = useState<StoryCollection["items"]>([]);
  const [seenGroupStart, setSeenGroupStart] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [newsComplete, setNewsComplete] = useState(false);
  // Incremented on every manual nav to reset the CSS animation
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const storage = browserStorage();
      setSeenIds(new Set([...readSeen(storage), ...[...readSeenBreakingNews(storage)].map((id) => `article:${id}`)]));
    };
    const id = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const orderedStories = useMemo(() => [...stories].sort((a, b) =>
    Number(unseenCount(b.items, seenIds) > 0) - Number(unseenCount(a.items, seenIds) > 0)
  ), [stories, seenIds]);
  // Freeze the visible topic order for an open viewing session.
  const isOpen = activeStoryIndex !== null;
  const activeSourceStory = activeStoryIndex !== null ? sessionStories[activeStoryIndex] : null;
  const activeStory = activeSourceStory
    ? { ...activeSourceStory, items: activeItems }
    : null;

  // ── helpers ──────────────────────────────────────────────────────────────

  const markSeen = useCallback((offerId: string) => {
    if (offerId.startsWith("article:")) markBreakingNewsSeen(browserStorage(), offerId.slice("article:".length));
    setSeenIds((prev) => {
      const next = addSeenOfferId(prev, offerId);
      if (next === prev) return prev;
      writeSeen(browserStorage(), new Set([...next].filter((id) => !id.startsWith("article:"))));
      return next;
    });
  }, []);

  const open = useCallback(
    (storyIndex: number) => {
      const story = orderedStories[storyIndex];
      if (!story) return;
      setPaused(false);
      setNewsComplete(false);
      setSessionStories(orderedStories);
      setActiveItems(orderBySeen(story.items, seenIds));
      setSeenGroupStart(resolveSeenGroupStart(story.items, seenIds));
      setActiveStoryIndex(storyIndex);
      setActiveItemIndex(0);
      setProgressKey((k) => k + 1);
    },
    [seenIds, orderedStories],
  );

  const close = useCallback(() => {
    setPaused(false);
    setNewsComplete(false);
    setActiveStoryIndex(null);
    setSessionStories([]);
    setActiveItemIndex(0);
    setActiveItems([]);
    setSeenGroupStart(null);
  }, []);

  const continueAfterNews = useCallback(() => {
    if (activeStoryIndex === null) return;
    const nextIndex = activeStoryIndex + 1;
    setNewsComplete(false);
    if (nextIndex >= sessionStories.length) { return; }
    const story = sessionStories[nextIndex];
    setActiveItems(orderBySeen(story.items, seenIds));
    setSeenGroupStart(resolveSeenGroupStart(story.items, seenIds));
    setActiveStoryIndex(nextIndex);
    setActiveItemIndex(0);
    setProgressKey((k) => k + 1);
  }, [activeStoryIndex, sessionStories, seenIds]);

  const next = useCallback(() => {
    if (activeStoryIndex === null || !activeStory) return;
    setPaused(false);
    setProgressKey((k) => k + 1);

    const isLastItem = activeItemIndex >= activeStory.items.length - 1;
    if (!isLastItem) {
      setActiveItemIndex((i) => i + 1);
      return;
    }
    // End of a topic: show a short interstitial, or the final completion screen.
    setNewsComplete(true);
  }, [activeStoryIndex, activeStory, activeItemIndex]);

  const prev = useCallback(() => {
    if (activeStoryIndex === null || !activeStory) return;
    setPaused(false);
    setProgressKey((k) => k + 1);

    if (activeItemIndex > 0) {
      setActiveItemIndex((i) => i - 1);
      return;
    }
    const prevStoryIndex = activeStoryIndex - 1;
    if (prevStoryIndex >= 0) {
      const prevStory = sessionStories[prevStoryIndex];
      const orderedItems = orderBySeen(prevStory.items, seenIds);
      setActiveItems(orderedItems);
      setSeenGroupStart(resolveSeenGroupStart(prevStory.items, seenIds));
      setActiveStoryIndex(prevStoryIndex);
      setActiveItemIndex(orderedItems.length - 1);
    }
  }, [activeStoryIndex, activeStory, activeItemIndex, sessionStories, seenIds]);

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
    orderedStories,
    sessionStories,
    newsComplete,
    continueAfterNews,
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
