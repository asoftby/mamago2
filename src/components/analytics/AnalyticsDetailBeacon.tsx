"use client";

import { useEffect, useRef } from "react";
import type { AnalyticsEntityType, AnalyticsVertical } from "@prisma/client";
import { postProductTelemetryEvent } from "@/lib/analytics/client";

type Props = {
  entityType: AnalyticsEntityType;
  entityId: string;
  vertical: AnalyticsVertical;
  cityId?: string | null;
  citySlug?: string | null;
  meta?: Record<string, unknown> | null;
};

/**
 * DETAIL_OPEN для страницы сущности (событие, место, оффер, программа,
 * статья, маршрут) — с клиента, ровно одно на загрузку страницы этой сущности.
 *
 * Раньше это был серверный компонент: событие писалось при каждом SSR-рендере,
 * включая ботов, превью мессенджеров и prefetch, а у анонимов `sessionId`
 * был id auth-сессии (обычно null). Теперь, как `PageViewTracker`, событие
 * уходит через `postProductTelemetryEvent` (с `mg_analytics_sid` и
 * `anonymousId`), а `/api/analytics/events` отсекает ботов по User-Agent.
 *
 * Пропсы и `meta.source = "detail"` не меняются: на них завязаны
 * рекомендации, буст и кабинет бизнеса.
 */
export function AnalyticsDetailBeacon({ entityType, entityId, vertical, cityId, citySlug, meta }: Props) {
  // Ref survives React Strict Mode's simulated unmount/remount, so dev double
  // effects never produce a second DETAIL_OPEN for the same entity.
  const sentForRef = useRef<string | null>(null);
  // meta is an inline object literal on the server pages (new identity each
  // render); serialize it so the effect depends on its content, not identity.
  const metaJson = meta ? JSON.stringify(meta) : "";

  useEffect(() => {
    const key = `${entityType}:${entityId}`;
    if (!entityId || sentForRef.current === key) return;
    sentForRef.current = key;
    void postProductTelemetryEvent({
      eventType: "DETAIL_OPEN",
      entityType,
      entityId,
      vertical,
      cityId: cityId ?? null,
      citySlug: citySlug ?? null,
      meta: { source: "detail", ...(metaJson ? (JSON.parse(metaJson) as Record<string, unknown>) : {}) },
    });
  }, [entityType, entityId, vertical, cityId, citySlug, metaJson]);

  return null;
}
