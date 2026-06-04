import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { scheduleBroadcastSchema } from "@/lib/broadcasts/schemas";
import { scheduleAdminBroadcast } from "@/server/services/admin/broadcast.service";

function isAdmin(role: string) {
  return role === Role.ADMIN || role === Role.MODERATOR;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = scheduleBroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = await params;

  try {
    const broadcast = await scheduleAdminBroadcast(id, new Date(parsed.data.scheduledAt));
    return NextResponse.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
