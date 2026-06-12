/**
 * GET /api/notifications
 * Единая лента уведомлений.
 *
 * Query:
 * - stream: "user" | "business"
 * - tab: "inbox" | "unread" | "archive" (legacy-алиас: "archived")
 * - limit (default 15, max 100)
 * - cursor: id последнего элемента предыдущей страницы → курсорный режим,
 *   стабильный порядок (createdAt desc, id desc), в ответе nextCursor
 * - offset (default 0) — legacy-режим, если cursor не передан
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
  enrichNotificationsWithLifecycle,
  getAccessibleSurfacesForUser,
  getNotificationsPage,
  getUnreadCount,
  getUserArchived,
  getUserInbox,
  getWelcomeIsRead,
  reconcileResolvedActionRequiredNotifications,
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
    const tabRaw = searchParams.get("tab");
    const tab = tabRaw === "archived" || tabRaw === "archive"
      ? "archive"
      : tabRaw === "unread"
        ? "unread"
        : "inbox";
    const limitRaw = parseInt(searchParams.get("limit") || "15", 10);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    const cursor = searchParams.get("cursor");
    const stream = parseStream(searchParams.get("stream"));

    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 15;

    const audienceUser = await resolveNotificationAudienceUser(user);
    const accessibleSurfaces = getAccessibleSurfacesForUser(audienceUser);

    const queryOpts = { 
      telegramConnected: telegramStatus.linked,
      accessibleSurfaces,
    };

    const resolutionState = await reconcileResolvedActionRequiredNotifications(user.id);

    const cursorMode = searchParams.has("cursor");
    let notifications;
    let nextCursor: string | null = null;
    if (cursorMode) {
      const page = await getNotificationsPage(user.id, {
        tab,
        cursor: cursor || null,
        limit,
        stream,
        options: queryOpts,
      });
      notifications = page.items;
      nextCursor = page.nextCursor;
    } else if (tab === "archive") {
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
      tab === "archive"
        ? await countUserArchived(user.id, { stream, options: queryOpts })
        : await countUnifiedNotifications(user.id, stream, queryOpts);
    const hasMore = cursorMode
      ? nextCursor != null
      : offset + notifications.length < total;

    const enrichedNotifications = enrichNotificationsWithLifecycle(
      notifications,
      resolutionState,
    );

    return NextResponse.json({
      notifications: enrichedNotifications,
      unreadCount,
      total,
      hasMore,
      nextCursor,
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
