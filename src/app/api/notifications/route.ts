/**
 * GET /api/notifications
 * Единая лента: сортировка «новые» (seenAt IS NULL) сверху, затем просмотренные; пагинация limit/offset.
 *
 * Query:
 * - stream: "user" | "business"
 * - limit (default 15, max 100)
 * - offset (default 0)
 * - unreadOnly=true — только для обратной совместимости (фильтр seenAt IS NULL)
 * - readOnly=true — устарело
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { shouldShowTelegramPrompt } from "@/lib/user/shouldShowTelegramPrompt";
import type { NotificationStreamFilter } from "@/server/services/notification.service";
import {
  countUnifiedNotifications,
  getReadNotifications,
  getUnifiedNotificationFeed,
  getUnreadCount,
  getUnreadNotifications,
  getWelcomeIsRead,
} from "@/server/services/notification.service";

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

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const readOnly = searchParams.get("readOnly") === "true";
    const limitRaw = parseInt(searchParams.get("limit") || "15", 10);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    const stream = parseStream(searchParams.get("stream"));

    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 15;

    const queryOpts = { telegramConnected: user.telegramConnected };

    if (readOnly && unreadOnly) {
      return NextResponse.json(
        { error: "Use either unreadOnly or readOnly, not both" },
        { status: 400 },
      );
    }

    let notifications;
    if (unreadOnly) {
      const cap = Math.min(limit, 200);
      notifications = await getUnreadNotifications(user.id, stream, queryOpts, cap);
    } else if (readOnly) {
      notifications = await getReadNotifications(
        user.id,
        Math.min(limit, 200),
        offset,
        stream,
        queryOpts,
      );
    } else {
      notifications = await getUnifiedNotificationFeed(
        user.id,
        limit,
        offset,
        stream,
        queryOpts,
      );
    }

    const unreadCount = await getUnreadCount(user.id, stream, queryOpts);
    const welcomeIsRead = await getWelcomeIsRead(user.id);
    const total = await countUnifiedNotifications(user.id, stream, queryOpts);
    const hasMore = offset + notifications.length < total;

    return NextResponse.json({
      notifications,
      unreadCount,
      total,
      hasMore,
      telegramConnected: user.telegramConnected,
      welcomeIsRead,
      showTelegramPrompt: shouldShowTelegramPrompt({
        telegramConnected: user.telegramConnected,
        welcomeIsRead,
      }),
    });
  } catch (error) {
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
