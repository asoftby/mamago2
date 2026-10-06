import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { activationRateLimitKey, checkActivationRateLimit } from "@/server/auth/activationRateLimit";
import { consentVersionMatches, familyConsentConfigured } from "@/server/family/familyConsent";
import { previewFamilyInviteMerge } from "@/server/family/familyMerge.service";
import { FamilyInviteError } from "@/server/family/familyInvitePure";
import { familyInvitesEnabled } from "@/server/family/familyScope";

const bodySchema = z.object({ token: z.string().min(10).max(200), consentTextVersion: z.string().min(1).max(64) }).strict();

/** Data for the merge step. Only after the consent is accepted; never before. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!familyInvitesEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
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
    const preview = await previewFamilyInviteMerge(prisma, {
      userId: user.id,
      token: parsed.data.token,
      consentTextVersion: parsed.data.consentTextVersion,
    });
    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof FamilyInviteError) {
      return NextResponse.json({ error: error.code }, { status: error.code === "invalid_invite" ? 404 : 409 });
    }
    console.error("[family] join preview failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
