import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { transferFamilyOwnership, FamilyMembersError } from "@/server/family/familyMembers.service";

const bodySchema = z.object({ targetUserId: z.string().min(1) }).strict();
const STATUS: Record<string, number> = {
  disabled: 404, not_member: 404, not_owner: 403, same_user: 400, target_not_member: 404, conflict: 409,
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await transferFamilyOwnership(prisma, { userId: user.id, targetUserId: parsed.data.targetUserId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FamilyMembersError) {
      return NextResponse.json({ error: error.code }, { status: STATUS[error.code] ?? 409 });
    }
    console.error("[family] transfer failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
