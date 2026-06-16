import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { resolveNotificationPageUrl } from "@/server/notifications/notification-action-resolver";

/**
 * GET /n/[id] — notification click-through resolver.
 *
 * Marks the notification as read/seen for the current user, then redirects to
 * the notification's destination (resolveNotificationPageUrl). Used as the
 * single href for clickable notification cards so the read-state side effect
 * and navigation happen server-side in one request.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    const loginUrl = new URL(
      `/login?redirectTo=${encodeURIComponent(`/n/${id}`)}`,
      request.url,
    );
    return NextResponse.redirect(loginUrl);
  }

  const notification = await prisma.notification.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      type: true,
      entityType: true,
      entityId: true,
      actionUrl: true,
      readAt: true,
      seenAt: true,
    },
  });

  if (!notification) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (notification.readAt === null) {
    const now = new Date();
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        readAt: now,
        seenAt: notification.seenAt ?? now,
      },
    });
  }

  const destination = resolveNotificationPageUrl({
    type: notification.type,
    entityType: notification.entityType,
    entityId: notification.entityId,
    actionUrl: notification.actionUrl,
  });

  return NextResponse.redirect(new URL(destination ?? "/notifications", request.url));
}
