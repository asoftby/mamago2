import "server-only";

import { getPublicAppUrl } from "@/features/email/lib/email-links";
import { emailService } from "@/features/email/server/email-service";

export interface SendWelcomeEmailParams {
  userId: string;
  email: string;
  userName?: string | null;
  ctaUrl?: string;
}

function resolveWelcomeCtaUrl(override?: string): string {
  if (override?.trim()) {
    return override.trim();
  }

  try {
    return getPublicAppUrl();
  } catch {
    return "https://mamago.by";
  }
}

/**
 * Безопасная отправка welcome email:
 * не бросает ошибку наружу, чтобы не ломать регистрацию.
 */
export async function sendWelcomeEmail({
  userId,
  email,
  userName,
  ctaUrl,
}: SendWelcomeEmailParams): Promise<{ ok: true } | { ok: false }> {
  try {
    await emailService.sendWelcomeEmail({
      userId,
      to: email,
      userName,
      ctaUrl: resolveWelcomeCtaUrl(ctaUrl),
    });
    return { ok: true };
  } catch (error) {
    console.error("[email] sendWelcomeEmail failed", {
      userId,
      email,
      error,
    });
    return { ok: false };
  }
}
