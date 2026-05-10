/**
 * GET /api/notifications/unread-count
 * 
 * Lightweight endpoint to fetch only unread notification count.
 * Used by badge/header to avoid fetching full notification objects.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import type { NotificationStreamFilter } from "@/server/services/notification.service";
import { getUnreadCount, getAccessibleSurfacesForUser } from "@/server/services/notification.service";
import { resolveNotificationAudienceUser } from "@/server/notifications/resolveNotificationAudienceUser";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";

function parseStream(
  raw: string | null,
): NotificationStreamFilter | undefined {
  if (raw === "user" || raw === "business") return raw;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const streamParam = request.nextUrl.searchParams.get("stream");
    const stream = parseStream(streamParam);

    const telegramStatus = await getTelegramLinkStatus({ userId: user.id });
    const audienceUser = await resolveNotificationAudienceUser(user);
    const accessibleSurfaces = getAccessibleSurfacesForUser(audienceUser);

    const queryOpts = {
      telegramConnected: telegramStatus.linked,
      accessibleSurfaces,
    };

    const unreadCount = await getUnreadCount(user.id, stream, queryOpts);

    return NextResponse.json({
      unreadCount,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
