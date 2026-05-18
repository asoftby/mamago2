import "server-only";

import { emailService } from "@/features/email/server/email-service";

/**
 * Email Adapter — legacy compatibility layer.
 *
 * Canonical delivery now lives in `emailService` and uses Resend.
 * This adapter remains only so older notification codepaths can delegate
 * without a larger refactor.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  /** Plain-text fallback */
  text: string;
  /** Optional HTML body */
  html?: string;
}

export interface EmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a transactional email.
 * Returns { ok: true } on success, { ok: false, error } on failure.
 * Never throws — callers rely on the return value.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const result = await emailService.sendRawEmail(payload);

  if (result.status === "SENT") {
    return { ok: true, messageId: result.messageId };
  }

  return { ok: false, error: result.reason ?? "EMAIL_SEND_FAILED" };
}
