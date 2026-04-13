import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createDevBusinessApplicationAndNotify } from "@/server/services/telegram/devTelegramBusinessApplication.service";
import { forceTelegramDeliveryForNotification } from "@/server/services/notificationDelivery.service";
import {
  notifyAdminModerationItemCreated,
  notifyUserPlanReminder,
} from "@/server/services/notification.service";

export const runtime = "nodejs";

const requestSchema = z.object({
  audience: z.enum(["USER", "BUSINESS", "ADMIN"]),
  type: z.string().optional(),
  targetUserId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { audience, targetUserId } = parsed.data;

  if (targetUserId !== currentUser.id && currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (audience === "USER") {
    const notification = await notifyUserPlanReminder({
      userId: targetUserId,
      title: "Напоминание о событии",
      body: "Завтра в 11:00 у вас запланирован семейный спектакль в mamaGo.",
      entityId: "dev-user-reminder",
    });
    await forceTelegramDeliveryForNotification(notification.id);

    return NextResponse.json({ ok: true, audience, notificationId: notification.id });
  }

  if (audience === "BUSINESS") {
    const { application, notification } = await createDevBusinessApplicationAndNotify({
      userId: targetUserId,
    });
    await forceTelegramDeliveryForNotification(notification.id);

    return NextResponse.json({
      ok: true,
      audience,
      notificationId: notification.id,
      applicationId: application.id,
    });
  }

  const notification = await notifyAdminModerationItemCreated({
    userId: targetUserId,
    itemTitle: "Новая карточка места ожидает модерации в dev-потоке.",
    itemId: "dev-admin-moderation-item",
  });
  await forceTelegramDeliveryForNotification(notification.id);

  return NextResponse.json({ ok: true, audience, notificationId: notification.id });
}
