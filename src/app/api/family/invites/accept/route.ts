import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { activationRateLimitKey, checkActivationRateLimit } from "@/server/auth/activationRateLimit";
import { consentVersionMatches, familyConsentConfigured } from "@/server/family/familyConsent";
import { acceptFamilyInvite } from "@/server/family/familyInvite.service";
import { notifyInviterJoined } from "@/server/family/familyJoin.service";
import { FamilyInviteError } from "@/server/family/familyInvitePure";

const mergeSchema = z
  .object({
    plan: z.enum(["PRIVATE", "FAMILY", "SKIP"]),
    children: z.array(
      z.discriminatedUnion("action", [
        z.object({ childId: z.string(), action: z.literal("SAME"), targetChildId: z.string() }).strict(),
        z.object({ childId: z.string(), action: z.literal("ADD") }).strict(),
        z.object({ childId: z.string(), action: z.literal("SKIP") }).strict(),
      ]),
    ).max(50),
  })
  .strict();

// historyAccess is NOT accepted from the client: a joiner starts with FROM_JOIN.
const bodySchema = z
  .object({
    token: z.string().min(10).max(200),
    consentTextVersion: z.string().min(1).max(64),
    merge: mergeSchema.optional(),
  })
  .strict();

const STATUS: Record<string, number> = {
  disabled: 404,
  invalid_invite: 404,
  consent_required: 400,
  merge_invalid: 400,
  already_member: 409,
  has_other_adults: 409,
  needs_merge: 409,
  conflict: 409,
};

/** Joins the family from an invite link. Consent (exact shown version) is mandatory. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!familyConsentConfigured()) return NextResponse.json({ error: "consent_unavailable" }, { status: 503 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!consentVersionMatches(parsed.data.consentTextVersion)) {
    return NextResponse.json({ error: "consent_required" }, { status: 400 });
  }
  const { allowed } = await checkActivationRateLimit({
    key: activationRateLimitKey("family-invite-join", user.id),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const { familyId } = await acceptFamilyInvite(prisma, {
      userId: user.id,
      token: parsed.data.token,
      consentTextVersion: parsed.data.consentTextVersion,
      merge: parsed.data.merge,
    });
    await notifyInviterJoined(prisma, { familyId, joinerUserId: user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FamilyInviteError) {
      return NextResponse.json({ error: error.code }, { status: STATUS[error.code] ?? 409 });
    }
    console.error("[family] join failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
