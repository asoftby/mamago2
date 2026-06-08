import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { archiveNotification } from "@/server/notifications/notification.service";
import { NotificationArchiveBlockedError } from "@/server/notifications/notification-lifecycle";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const notification = await archiveNotification(user.id, id);
    return NextResponse.json({ notification });
  } catch (error) {
    if (error instanceof NotificationArchiveBlockedError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "Notification not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
