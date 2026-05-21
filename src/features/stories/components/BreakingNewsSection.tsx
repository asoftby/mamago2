"use client";

import { useState, useCallback, useEffect } from "react";
import { BreakingNewsRingItem } from "./BreakingNewsRingItem";
import { BreakingNewsModal } from "./BreakingNewsModal";
import type { BreakingNewsItem } from "../lib/listBreakingNews";

const SEEN_STORAGE_KEY = "mamago.breaking-news.seen";

interface BreakingNewsSectionProps {
  items: BreakingNewsItem[];
}

export function BreakingNewsSection({ items }: BreakingNewsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(SEEN_STORAGE_KEY);
      if (raw) return new Set<string>(JSON.parse(raw));
    } catch {}
    return new Set();
  });

  // Если нет новостей — кружок всегда muted (нет контента)
  // Если все новости просмотрены — кружок muted
  const allSeen = items.length === 0 || items.every((item) => seenIds.has(item.id));
  const latestCoverImageUrl = items[0]?.imageUrl ?? null;

  const open = useCallback(() => {
    if (items.length === 0) return; // Не открывать модалку, если нет новостей
    setIsOpen(true);
    // Помечаем все текущие breaking news как просмотренные
    setSeenIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => next.add(item.id));
      try {
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, [items]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ── keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  return (
    <>
      <BreakingNewsRingItem
        title="Срочно"
        seen={allSeen}
        onClick={open}
        itemCount={items.length}
        coverImageUrl={latestCoverImageUrl}
      />

      {isOpen && <BreakingNewsModal newsItems={items} onClose={close} />}
    </>
  );
}
