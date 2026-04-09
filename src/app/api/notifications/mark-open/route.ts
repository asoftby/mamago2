/**
 * POST /api/notifications/mark-open
 * Помечает все текущие «новые» уведомления как просмотренные (seenAt) при открытии центра.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { shouldShowTelegramPrompt } from "@/lib/user/shouldShowTelegramPrompt";
import type { NotificationStreamFilter } from "@/server/services/notification.service";
import {
  getUnreadCount,
  getWelcomeIsRead,
  markUnseenNotificationsAsSeen,
} from "@/server/services/notification.service";

function parseStream(
  raw: string | null,
): NotificationStreamFilter | undefined {
  if (raw === "user" || raw === "business") return raw;
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stream = parseStream(searchParams.get("stream"));
    const queryOpts = { telegramConnected: user.telegramConnected };

    const result = await markUnseenNotificationsAsSeen(user.id, stream, queryOpts);

    const [unreadCount, welcomeIsRead] = await Promise.all([
      getUnreadCount(user.id, stream, queryOpts),
      getWelcomeIsRead(user.id),
    ]);

    return NextResponse.json({
      updated: result.count,
      unreadCount,
      welcomeIsRead,
      showTelegramPrompt: shouldShowTelegramPrompt({
        telegramConnected: user.telegramConnected,
        welcomeIsRead,
      }),
    });
  } catch (error) {
    console.error("[notifications/mark-open]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
