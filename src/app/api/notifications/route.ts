/**
 * GET /api/notifications
 * Get user's notifications
 * 
 * Query params:
 * - unreadOnly: boolean (default: false)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - stream: "user" | "business" — фильтр по потоку (личные / бизнес)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import type { NotificationStreamFilter } from "@/server/services/notification.service";
import {
  getUserNotifications,
  getUnreadNotifications,
  getUnreadCount,
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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const stream = parseStream(searchParams.get("stream"));

    let notifications;
    if (unreadOnly) {
      notifications = await getUnreadNotifications(user.id, stream);
    } else {
      notifications = await getUserNotifications(user.id, limit, offset, stream);
    }

    const unreadCount = await getUnreadCount(user.id, stream);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
