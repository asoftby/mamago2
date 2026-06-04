import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { createBroadcastCorrectionDraft } from "@/server/services/admin/broadcast.service";

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
    const broadcast = await createBroadcastCorrectionDraft(id, user.id);
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
