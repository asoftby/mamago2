import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DirectMessageHiddenReason } from "@prisma/client";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { hideMessage, DirectMessageError } from "@/server/services/direct/directMessage.service";

const bodySchema = z.object({
  reason: z.nativeEnum(DirectMessageHiddenReason),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { messageId } = await params;

  try {
    const json = await request.json();
    const { reason } = bodySchema.parse(json);

    const updated = await hideMessage({
      messageId,
      hiddenByUserId: auth.id,
      actorRole: auth.role,
      reason,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if (error instanceof DirectMessageError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[admin/direct] hide message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
