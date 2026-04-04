"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { AnalyticsEntityType, AnalyticsVertical } from "@prisma/client";
import { postAnalyticsEvent } from "@/lib/analytics/client";

type Props = {
  entityType: AnalyticsEntityType;
  entityId: string;
  vertical: AnalyticsVertical;
  citySlug?: string;
  meta?: Record<string, unknown>;
  children: ReactNode;
  /** Доля видимости области для срабатывания (один раз) */
  threshold?: number;
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
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= threshold);
        if (!hit || fired.current) return;
        fired.current = true;
        obs.disconnect();
        const m = metaRef.current;
        void postAnalyticsEvent({
          eventType: "CARD_VIEW",
          entityType,
          entityId,
          vertical,
          citySlug: citySlug ?? null,
          meta: { source: "listing", ...m },
        });
      },
      { threshold: [0, threshold, 0.5, 1], rootMargin: "0px 0px -5% 0px" },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [entityId, entityType, vertical, citySlug, threshold]);

  return (
    <div ref={ref} className="block h-full min-h-[1px] w-full">
      {children}
    </div>
  );
}
