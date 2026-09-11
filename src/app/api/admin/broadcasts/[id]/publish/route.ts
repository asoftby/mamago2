import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { publishAdminBroadcastWithDelivery } from "@/server/services/admin/broadcastDelivery.service";

function isAdmin(role: string) {
  return role === Role.ADMIN || role === Role.MODERATOR;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await publishAdminBroadcastWithDelivery(id);
    return NextResponse.json({
      broadcast: result.broadcast,
      notificationsCreated: result.notificationsCreated,
      emailDelivery: result.emailDelivery,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
