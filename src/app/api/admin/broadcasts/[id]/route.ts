import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import {
  getAdminBroadcastById,
  updateAdminBroadcast,
} from "@/server/services/admin/broadcast.service";
import { updateBroadcastSchema } from "@/lib/broadcasts/schemas";

function isAdmin(role: string) {
  return role === Role.ADMIN || role === Role.MODERATOR;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const broadcast = await getAdminBroadcastById(id);
  if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ broadcast });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateBroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const scheduledAt = parsed.data.scheduledAt
      ? new Date(parsed.data.scheduledAt)
      : (parsed.data.scheduledAt as Date | null | undefined);
    const broadcast = await updateAdminBroadcast(id, {
      ...parsed.data,
      scheduledAt,
    });
    return NextResponse.json({ broadcast });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
