"use client";

import { useState, useCallback, useEffect } from "react";
import { readSeen, writeSeen, markSeen } from "../lib/seen";
import { BreakingNewsRingItem } from "./BreakingNewsRingItem";
import { BreakingNewsModal } from "./BreakingNewsModal";
import type { BreakingNewsItem } from "../lib/listBreakingNews";

interface BreakingNewsSectionProps {
  items: BreakingNewsItem[];
}

export function BreakingNewsSection({ items }: BreakingNewsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSeenIds(readSeen(window.localStorage)); }, []);

  // Если нет новостей — кружок всегда muted (нет контента)
  // Если все новости просмотрены — кружок muted
  const allSeen = items.length === 0 || items.every((item) => seenIds.has(`article:${item.id}`));
  const latestCoverImageUrl = items[0]?.imageUrl ?? null;

  const open = useCallback(() => {
    if (items.length === 0) return; // Не открывать модалку, если нет новостей
    setIsOpen(true);

  }, [items]);

  const onItemShown = useCallback((id: string) => {
    const key = `article:${id}`;
    setSeenIds((previous) => {
      const next = markSeen(previous, key);
      writeSeen(window.localStorage, next);
      return next;
    });
  }, []);

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

      {isOpen && <BreakingNewsModal newsItems={items} onClose={close} onItemShown={onItemShown} />}
    </>
  );
}
