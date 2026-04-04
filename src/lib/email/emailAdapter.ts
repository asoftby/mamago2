/**
 * Email Adapter — delivery abstraction for mamaGo notifications.
 *
 * Currently a stub: logs to console in dev, ready for real provider.
 * To wire a real provider (Resend, nodemailer, SES):
 *   1. Install the package
 *   2. Add env vars (EMAIL_FROM, RESEND_API_KEY / SMTP_HOST etc.)
 *   3. Replace the stub body in sendEmail() below
 *
 * This file is the ONLY place that knows about the email provider.
 * notification.service.ts never imports a provider directly.
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
  const from = process.env.EMAIL_FROM;

  // No provider configured — skip silently in prod, log in dev
  if (!from || from === "noreply@example.com") {
    if (process.env.NODE_ENV !== "production") {
      console.log("[email:stub] Would send email:", {
        to: payload.to,
        subject: payload.subject,
      });
    }
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" };
  }

  // TODO: replace stub with real provider
  // Example with Resend:
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   const { data, error } = await resend.emails.send({ from, ...payload });
  //   if (error) return { ok: false, error: error.message };
  //   return { ok: true, messageId: data?.id };
  //
  // Example with nodemailer:
  //   const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, ... });
  //   const info = await transporter.sendMail({ from, ...payload });
  //   return { ok: true, messageId: info.messageId };

  console.warn("[email] Provider not implemented. Set EMAIL_FROM and wire a provider.");
  return { ok: false, error: "EMAIL_PROVIDER_NOT_IMPLEMENTED" };
}
