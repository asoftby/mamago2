/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the current user
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { markAllNotificationsAsRead } from "@/server/services/notification.service";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await markAllNotificationsAsRead(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark all as read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
