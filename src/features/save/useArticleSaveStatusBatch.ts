"use client";

import { useEffect, useState } from "react";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import type { ArticleSaveStatus } from "@/features/save/ArticleSaveHeart";

const EMPTY_STATUSES: Record<string, ArticleSaveStatus> = {};

/**
 * Один батч-запрос save-статуса для набора статей на карточной странице
 * (вместо N/card запросов). Ничего не делает для гостей.
 */
export function useArticleSaveStatusBatch(
  articleIds: string[],
): Record<string, ArticleSaveStatus> {
  const { isAuthenticated } = useAuthMe();
  const [rawStatuses, setRawStatuses] = useState<Record<string, ArticleSaveStatus>>(
    EMPTY_STATUSES,
  );
  const key = articleIds.join(",");

  useEffect(() => {
    if (!isAuthenticated || !key) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/save/status/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleIds: key.split(",") }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          statuses?: Record<string, ArticleSaveStatus>;
        };
        if (!cancelled) setRawStatuses(data.statuses ?? EMPTY_STATUSES);
      } catch {
        if (!cancelled) setRawStatuses(EMPTY_STATUSES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, key]);

  return isAuthenticated && key ? rawStatuses : EMPTY_STATUSES;
}
