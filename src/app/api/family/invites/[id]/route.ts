import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { revokeFamilyInvite, FamilyInviteError } from "@/server/family/familyInvite.service";

const STATUS: Record<string, number> = { disabled: 404, invalid_invite: 404, not_member: 403 };

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await revokeFamilyInvite(prisma, { userId: user.id, inviteId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FamilyInviteError) {
      return NextResponse.json({ error: error.code }, { status: STATUS[error.code] ?? 409 });
    }
    console.error("[family] revoke failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
