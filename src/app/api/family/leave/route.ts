import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { leaveFamily, FamilyMembersError } from "@/server/family/familyMembers.service";

const bodySchema = z.object({ copyChildren: z.boolean().optional() }).strict();
const STATUS: Record<string, number> = {
  disabled: 404, not_member: 404, owner_must_transfer: 409, last_adult: 409, conflict: 409,
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await leaveFamily(prisma, { userId: user.id, copyChildren: parsed.data.copyChildren });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FamilyMembersError) {
      return NextResponse.json({ error: error.code }, { status: STATUS[error.code] ?? 409 });
    }
    console.error("[family] leave failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
