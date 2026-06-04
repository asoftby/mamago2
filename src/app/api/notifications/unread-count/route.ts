/**
 * GET /api/notifications/unread-count
 * 
 * Lightweight endpoint to fetch only unread notification count.
 * Used by badge/header to avoid fetching full notification objects.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import type { NotificationStreamFilter } from "@/server/services/notification.service";
import { getUnreadCount, getAccessibleSurfacesForUser } from "@/server/notifications/notification.service";
import { resolveNotificationAudienceUser } from "@/server/notifications/resolveNotificationAudienceUser";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";

function parseStream(
  raw: string | null,
): NotificationStreamFilter | undefined {
  if (raw === "user" || raw === "business") return raw;
  return undefined;
}

export async function GET(request: NextRequest) {
  const totalStart = performance.now();
  try {
    const authStart = performance.now();
    const user = await getCurrentUser();
    if (process.env.NODE_ENV === "development") {
      console.debug(`[unread-count] auth: ${(performance.now() - authStart).toFixed(0)}ms`);
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const streamParam = request.nextUrl.searchParams.get("stream");
    const stream = parseStream(streamParam);

    // Run telegram status and audience resolution in parallel
    const [telegramStatus, audienceUser] = await Promise.all([
      (async () => {
        const tStart = performance.now();
        const result = await getTelegramLinkStatus({ userId: user.id });
        if (process.env.NODE_ENV === "development") {
          console.debug(`[unread-count] telegram: ${(performance.now() - tStart).toFixed(0)}ms`);
        }
        return result;
      })(),
      (async () => {
        const aStart = performance.now();
        const result = await resolveNotificationAudienceUser(user);
        if (process.env.NODE_ENV === "development") {
          console.debug(`[unread-count] audience: ${(performance.now() - aStart).toFixed(0)}ms`);
        }
        return result;
      })(),
    ]);

    const surfacesStart = performance.now();
    const accessibleSurfaces = getAccessibleSurfacesForUser(audienceUser);
    if (process.env.NODE_ENV === "development") {
      console.debug(`[unread-count] surfaces: ${(performance.now() - surfacesStart).toFixed(0)}ms`);
    }

    const queryOpts = {
      telegramConnected: telegramStatus.linked,
      accessibleSurfaces,
    };

    const dbStart = performance.now();
    const unreadCount = await getUnreadCount(user.id, stream, queryOpts);
    if (process.env.NODE_ENV === "development") {
      console.debug(`[unread-count] db: ${(performance.now() - dbStart).toFixed(0)}ms`);
    }

    if (process.env.NODE_ENV === "development") {
      console.debug(`[unread-count] total: ${(performance.now() - totalStart).toFixed(0)}ms`);
    }
    return NextResponse.json({
      unreadCount,
    });
  } catch (error) {
    const schemaErrorResponse = prismaToHttpResponse(error);
    if (schemaErrorResponse && process.env.NODE_ENV === "development") {
      console.warn("[unread-count] schema drift detected, returning fallback unreadCount=0");
      return NextResponse.json({ unreadCount: 0, degraded: true });
    }

    if (schemaErrorResponse) {
      return schemaErrorResponse;
    }

    console.error("Get unread count error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
