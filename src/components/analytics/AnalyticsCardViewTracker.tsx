"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { AnalyticsEntityType, AnalyticsVertical } from "@prisma/client";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { createImpressionGate } from "@/lib/analytics/impressionGate";

type Props = {
  entityType: AnalyticsEntityType;
  entityId: string;
  vertical: AnalyticsVertical;
  citySlug?: string;
  meta?: Record<string, unknown>;
  children: ReactNode;
  /** Доля видимости области для срабатывания (один раз) */
  threshold?: number;
  /**
   * Показ по правилу «≥ threshold площади непрерывно ≥ dwellMs» (для рекомендательных блоков:
   * threshold=0.5, dwellMs=1000). Без значения — прежнее поведение (срабатывание сразу).
   */
  dwellMs?: number;
};

/**
 * CARD_VIEW один раз, когда карточка заметно попала в viewport (IntersectionObserver).
 */
export function AnalyticsCardViewTracker({
  entityType,
  entityId,
  vertical,
  citySlug,
  meta,
  children,
  threshold = 0.35,
  dwellMs,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);
  const metaRef = useRef(meta);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const send = () => {
      if (fired.current) return;
      fired.current = true;
      const m = metaRef.current;
      void postAnalyticsEvent({
        eventType: "CARD_VIEW",
        entityType,
        entityId,
        vertical,
        citySlug: citySlug ?? null,
        meta: { source: "listing", ...m, ...(dwellMs ? { impression: true } : {}) },
      });
    };
    const gate = dwellMs
      ? createImpressionGate({ threshold, dwellMs, onImpression: () => { send(); obs.disconnect(); } })
      : null;

    const obs = new IntersectionObserver(
      (entries) => {
        if (fired.current) return;
        if (gate) {
          for (const e of entries) gate.update(e.isIntersecting ? e.intersectionRatio : 0);
          return;
        }
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= threshold);
        if (!hit) return;
        obs.disconnect();
        send();
      },
      { threshold: [0, threshold, 0.5, 1], rootMargin: "0px 0px -5% 0px" },
    );

    obs.observe(el);
    return () => {
      gate?.cancel();
      obs.disconnect();
    };
  }, [entityId, entityType, vertical, citySlug, threshold, dwellMs]);

  return (
    <div ref={ref} className="block h-full min-h-[1px] w-full">
      {children}
    </div>
  );
}
