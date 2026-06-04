/**
 * GET /api/notifications
 * Единая лента уведомлений.
 *
 * Query:
 * - stream: "user" | "business"
 * - tab: "inbox" | "unread" | "archived"
 * - limit (default 15, max 100)
 * - offset (default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import { getCurrentUser } from "@/lib/auth/server";
import { shouldShowTelegramPrompt } from "@/lib/user/shouldShowTelegramPrompt";
import type { NotificationStreamFilter } from "@/server/services/notification.service";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import {
  countUserArchived,
  countUnifiedNotifications,
  getAccessibleSurfacesForUser,
  getUnreadCount,
  getUserArchived,
  getUserInbox,
  getWelcomeIsRead,
} from "@/server/notifications/notification.service";
import { resolveNotificationAudienceUser } from "@/server/notifications/resolveNotificationAudienceUser";

function parseStream(
  raw: string | null,
): NotificationStreamFilter | undefined {
  if (raw === "user" || raw === "business") return raw;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const telegramStatus = await getTelegramLinkStatus({ userId: user.id });

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") === "archived"
      ? "archived"
      : searchParams.get("tab") === "unread"
        ? "unread"
        : "inbox";
    const limitRaw = parseInt(searchParams.get("limit") || "15", 10);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    const stream = parseStream(searchParams.get("stream"));

    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 15;

    const audienceUser = await resolveNotificationAudienceUser(user);
    const accessibleSurfaces = getAccessibleSurfacesForUser(audienceUser);

    const queryOpts = { 
      telegramConnected: telegramStatus.linked,
      accessibleSurfaces,
    };

    let notifications;
    if (tab === "archived") {
      notifications = await getUserArchived(user.id, {
        limit,
        offset,
        stream,
        options: queryOpts,
      });
    } else {
      notifications = await getUserInbox(user.id, {
        limit,
        offset,
        unreadOnly: tab === "unread",
        stream,
        options: queryOpts,
      });
    }

    const unreadCount = await getUnreadCount(user.id, stream, queryOpts);
    const welcomeIsRead = await getWelcomeIsRead(user.id);
    const total =
      tab === "archived"
        ? await countUserArchived(user.id, { stream, options: queryOpts })
        : await countUnifiedNotifications(user.id, stream, queryOpts);
    const hasMore = offset + notifications.length < total;

    return NextResponse.json({
      notifications,
      unreadCount,
      total,
      hasMore,
      telegramConnected: telegramStatus.linked,
      welcomeIsRead,
      showTelegramPrompt: shouldShowTelegramPrompt({
        telegramConnected: telegramStatus.linked,
        welcomeIsRead,
      }),
    });
  } catch (error) {
    const schemaErrorResponse = prismaToHttpResponse(error);
    if (schemaErrorResponse && process.env.NODE_ENV === "development") {
      console.warn("[notifications] schema drift detected, returning empty feed fallback");
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
        total: 0,
        hasMore: false,
        telegramConnected: false,
        welcomeIsRead: true,
        showTelegramPrompt: false,
        degraded: true,
      });
    }

    if (schemaErrorResponse) {
      return schemaErrorResponse;
    }

    console.error("Get notifications error:", error);
    const isDev = process.env.NODE_ENV === "development";
    const payload: {
      error: string;
      details?: string;
      code?: string;
    } = { error: "Internal server error" };
    if (isDev && error instanceof Error) {
      payload.details = error.message;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        payload.code = error.code;
      }
    }
    return NextResponse.json(payload, { status: 500 });
  }
}
