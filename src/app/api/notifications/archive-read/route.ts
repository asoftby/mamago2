import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { archiveAllRead } from "@/server/notifications/notification.service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await archiveAllRead(user.id);
  return NextResponse.json({ ok: true, count: result.count });
}
