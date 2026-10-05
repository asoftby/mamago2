import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { createInviteAndNotify } from "@/server/family/familyInviteDelivery.service";
import { FamilyInviteError } from "@/server/family/familyInvitePure";
import { FamilyMembersError } from "@/server/family/familyMembersPure";

const bodySchema = z.object({ email: z.string().max(254).optional() }).strict();
const INVITE_STATUS: Record<string, number> = { disabled: 404, not_member: 403, limit_reached: 409 };
const MEMBERS_STATUS: Record<string, number> = { invalid_email: 400, rate_limited: 429 };

/** Creates a one-time invite link; an optional email only triggers a letter (never stored). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const res = await createInviteAndNotify(prisma, { userId: user.id, email: parsed.data.email });
    return NextResponse.json({
      invite: { id: res.inviteId, url: res.url, expiresAt: res.expiresAt.toISOString(), emailSent: res.emailSent },
    });
  } catch (error) {
    if (error instanceof FamilyInviteError) {
      return NextResponse.json({ error: error.code }, { status: INVITE_STATUS[error.code] ?? 409 });
    }
    if (error instanceof FamilyMembersError) {
      return NextResponse.json({ error: error.code }, { status: MEMBERS_STATUS[error.code] ?? 400 });
    }
    console.error("[family] invite failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
