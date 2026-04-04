import type { AnalyticsEntityType, AnalyticsVertical } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";

type Props = {
  entityType: AnalyticsEntityType;
  entityId: string;
  vertical: AnalyticsVertical;
  cityId?: string | null;
  citySlug?: string | null;
  meta?: Record<string, unknown> | null;
};

/**
 * Серверный no-op визуально: пишет DETAIL_OPEN в UserEvent (лёгкий insert).
 */
export async function AnalyticsDetailBeacon({
  entityType,
  entityId,
  vertical,
  cityId,
  citySlug,
  meta,
}: Props) {
  const user = await getCurrentUser();
  const sessionRowId = await getSessionRowIdFromCookies();

  void trackUserEvent({
    eventType: "DETAIL_OPEN",
    userId: user?.id ?? null,
    sessionId: sessionRowId,
    entityType,
    entityId,
    vertical,
    cityId: cityId ?? null,
    citySlug: citySlug ?? null,
    meta: { source: "detail", ...(meta ?? {}) },
  });

  return null;
}
