import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { resolveNotificationClickthroughDestination } from "@/lib/notifications/notificationClickthroughDestination";
import prisma from "@/lib/prisma";
import { resolveNotificationPageUrl } from "@/server/notifications/notification-action-resolver";

function redirectToRelativePath(path: string, status = 307): NextResponse {
  return new NextResponse(null, {
    status,
    headers: {
      Location: path,
    },
  });
}

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
    return redirectToRelativePath(
      buildAuthUrl({
        redirectTo: `/n/${id}`,
      }),
    );
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
    return redirectToRelativePath("/");
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

  const resolvedDestination = resolveNotificationClickthroughDestination({
    destination,
    currentHost: request.headers.get("host") ?? request.nextUrl.host,
    currentProtocol: request.nextUrl.protocol,
  });

  if (resolvedDestination) {
    return redirectToRelativePath(resolvedDestination);
  }

  return redirectToRelativePath("/notifications");
}
