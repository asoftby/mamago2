/**
 * GET /api/notifications
 * Get user's notifications
 * 
 * Query params:
 * - unreadOnly: boolean (default: false)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getUserNotifications,
  getUnreadNotifications,
  getUnreadCount,
} from "@/server/services/notification.service";

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

    let notifications;
    if (unreadOnly) {
      notifications = await getUnreadNotifications(user.id);
    } else {
      notifications = await getUserNotifications(user.id, limit, offset);
    }

    const unreadCount = await getUnreadCount(user.id);

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
