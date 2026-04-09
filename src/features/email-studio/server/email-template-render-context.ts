/**
 * Email Template Render Context Builder
 *
 * Builds a real EmailTemplateRenderContext for a specific user.
 * Used when sending actual (non-preview) emails via Email Studio templates.
 */

import "server-only";
import prisma from "@/lib/prisma";
import { buildUnsubscribeUrl } from "@/features/email/lib/unsubscribe-links";
import { shouldSendEmail } from "@/features/email-studio/server/email-sending-rules";
import type { EmailTemplateRenderContext } from "@/features/email-studio/server/email-template-preview";
import type { EmailTemplateType } from "@/features/email-studio/lib";

function getDefaultHomeUrl(): string {
  return (
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://mamago.by"
  );
}

function getDefaultSupportEmail(): string {
  return (
    process.env.EMAIL_REPLY_TO?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "support@mamago.by"
  );
}

export type BuildUserRenderContextInput = {
  userId: string;
  templateType: EmailTemplateType;
  /** Override home URL (e.g. deep link into plan) */
  homeUrl?: string;
};

export type BuildUserRenderContextResult =
  | { ok: true; context: EmailTemplateRenderContext }
  | { ok: false; reason: "user_not_found" | "opted_out" };

/**
 * Build a real render context for a specific user.
 *
 * - Fetches user data from DB
 * - Checks marketingEmailsEnabled for marketing emails
 * - Generates a personalized unsubscribeUrl for marketing emails
 * - Returns { ok: false, reason: "opted_out" } if user has opted out
 *
 * @example
 * const result = await buildUserRenderContext({ userId, templateType: "WEEKLY_DIGEST" });
 * if (!result.ok) return; // skip sending
 * await renderEmailTemplateToHtml(template.document, result.context, ...);
 */
export async function buildUserRenderContext(
  input: BuildUserRenderContextInput,
): Promise<BuildUserRenderContextResult> {
  const { userId, templateType, homeUrl: homeUrlOverride } = input;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      email: true,
      marketingEmailsEnabled: true,
    },
  });

  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  // Check marketing email preference
  if (!shouldSendEmail(templateType, user.marketingEmailsEnabled)) {
    return { ok: false, reason: "opted_out" };
  }

  const homeUrl = homeUrlOverride ?? getDefaultHomeUrl();
  const supportEmail = getDefaultSupportEmail();

  // Generate personalized unsubscribe URL for marketing emails
  // Transactional emails don't need unsubscribe URL
  let unsubscribeUrl: string | null = null;
  try {
    unsubscribeUrl = await buildUnsubscribeUrl(userId);
  } catch (error) {
    // Non-fatal: log and continue without unsubscribe URL
    console.error("[email-render-context] Failed to generate unsubscribeUrl:", error);
  }

  const firstName = user.displayName?.split(" ")[0]?.trim() ?? null;

  const context: EmailTemplateRenderContext = {
    user: {
      firstName,
      fullName: user.displayName ?? null,
    },
    city: {
      name: null, // Caller can override if needed
    },
    links: {
      homeUrl,
      verifyEmailUrl: null,    // Not needed for marketing emails
      resetPasswordUrl: null,  // Not needed for marketing emails
      unsubscribeUrl,
    },
    plan: {
      date: null, // Caller can override if needed
    },
    brand: {
      name: "mamaGo",
      supportEmail,
    },
  };

  return { ok: true, context };
}
