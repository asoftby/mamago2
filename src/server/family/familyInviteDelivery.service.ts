import type { PrismaClient } from "@prisma/client";
import { emailService } from "@/features/email/server/email-service";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { checkActivationRateLimit, activationRateLimitKey } from "@/server/auth/activationRateLimit";
import { createFamilyInvite } from "./familyInvite.service";
import {
  FamilyMembersError,
  INVITE_EMAILS_PER_USER_PER_DAY,
  INVITE_EMAIL_WINDOW_MS,
  normalizeInviteEmail,
} from "./familyMembersPure";

export const FAMILY_INVITE_ACCEPT_PATH = "/invite/family";

export function buildFamilyInviteUrl(token: string): string {
  return `${getCanonicalPublicAppUrl()}${FAMILY_INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
}

/**
 * Creates a one-time invite link. With `email` also sends a neutral letter (no child
 * or plan data). The address is used ONLY to send the letter and is never stored; the
 * link may be accepted by any signed-in account holding it. Letters are limited per user per day.
 */
export async function createInviteAndNotify(
  prisma: PrismaClient,
  input: { userId: string; email?: string | null },
  deps: { limiter?: typeof checkActivationRateLimit } = {},
): Promise<{ inviteId: string; url: string; emailSent: boolean }> {
  const email = input.email?.trim() ? normalizeInviteEmail(input.email) : null;
  if (input.email?.trim() && !email) throw new FamilyMembersError("invalid_email");
  if (email) {
    const limiter = deps.limiter ?? checkActivationRateLimit;
    const { allowed } = await limiter({
      key: activationRateLimitKey("family-invite-email", input.userId),
      limit: INVITE_EMAILS_PER_USER_PER_DAY,
      windowMs: INVITE_EMAIL_WINDOW_MS,
    });
    if (!allowed) throw new FamilyMembersError("rate_limited");
  }

  const invite = await createFamilyInvite(prisma, { userId: input.userId });
  const url = buildFamilyInviteUrl(invite.token);

  let emailSent = false;
  if (email) {
    const inviter = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { displayName: true },
    });
    try {
      emailSent = await emailService.sendFamilyInvite({
        to: email,
        inviterName: inviter?.displayName,
        acceptUrl: url,
      });
    } catch (error) {
      // The link is still valid and can be copied; never log the address.
      console.error("[familyInvite] letter failed", error instanceof Error ? error.message : "unknown");
    }
  }
  return { inviteId: invite.inviteId, url, emailSent };
}
