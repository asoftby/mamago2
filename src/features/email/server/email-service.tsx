import "server-only";
import type { ReactElement } from "react";

import MamagoWelcomeTemplate from "../../../../emails/mamago-welcome";
import PasswordResetTemplate from "../templates/password-reset";
import VerifyEmailTemplate from "../templates/verify-email";
import BusinessInviteTemplate from "../templates/business-invite";
import {
  buildPasswordResetUrl,
  buildVerifyEmailUrl,
} from "../lib/email-links";
import { EMAIL_SUBJECTS } from "../lib/email-subjects";
import { getResendClient } from "./resend-client";

function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

function getDebugRedirectTo(): string | undefined {
  const v = process.env.EMAIL_DEBUG_REDIRECT_TO?.trim();
  return v || undefined;
}

function assertConfiguredForResend(): void {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY обязателен при EMAIL_ENABLED=true.");
  }
  if (!process.env.EMAIL_FROM?.trim()) {
    throw new Error("EMAIL_FROM обязателен при EMAIL_ENABLED=true.");
  }
  if (!process.env.EMAIL_REPLY_TO?.trim()) {
    throw new Error("EMAIL_REPLY_TO обязателен при EMAIL_ENABLED=true.");
  }
}

function getFrom(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    throw new Error("EMAIL_FROM не задан.");
  }
  return from;
}

function getReplyTo(): string {
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  if (!replyTo) {
    throw new Error("EMAIL_REPLY_TO не задан.");
  }
  return replyTo;
}

function getMissingResendEnvKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
  if (!process.env.EMAIL_FROM?.trim()) missing.push("EMAIL_FROM");
  if (!process.env.EMAIL_REPLY_TO?.trim()) missing.push("EMAIL_REPLY_TO");
  return missing;
}

function getEmailDeliveryConfigurationStatus(): {
  enabled: boolean;
  configured: boolean;
  missingKeys: string[];
} {
  const enabled = isEmailEnabled();
  const missingKeys = getMissingResendEnvKeys();
  return {
    enabled,
    configured: enabled && missingKeys.length === 0,
    missingKeys,
  };
}

type EmailKind = "verify-email" | "password-reset" | "welcome" | "notification" | "business-invite";

type SendViaResendInput =
  | {
      kind: EmailKind;
      intendedTo: string;
      subject: string;
      react: ReactElement;
    }
  | {
      kind: EmailKind;
      intendedTo: string;
      subject: string;
      text: string;
      html?: string;
    };

async function sendViaResend(input: SendViaResendInput): Promise<{ messageId?: string | null }> {
  assertConfiguredForResend();
  const debugTo = getDebugRedirectTo();
  const to = debugTo ?? input.intendedTo;
  const resend = getResendClient();
  const from = getFrom();
  const replyTo = getReplyTo();

  console.info("[email] sending", {
    kind: input.kind,
    intendedTo: input.intendedTo,
    actualTo: to,
    debugRedirect: Boolean(debugTo),
    subject: input.subject,
  });

  const payload =
    "react" in input
      ? {
          from,
          to: [to],
          replyTo: [replyTo],
          subject: input.subject,
          react: input.react,
          tags: [{ name: "type", value: input.kind }],
        }
      : {
          from,
          to: [to],
          replyTo: [replyTo],
          subject: input.subject,
          text: input.text,
          html: input.html,
          tags: [{ name: "type", value: input.kind }],
        };

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error("[email] Resend error", {
      kind: input.kind,
      intendedTo: input.intendedTo,
      message: error.message,
    });
    throw new Error(`Resend: ${error.message}`);
  }

  console.info("[email] sent", {
    kind: input.kind,
    intendedTo: input.intendedTo,
    messageId: data?.id ?? null,
  });
  return { messageId: data?.id ?? null };
}

export class EmailService {
  getHealth() {
    return getEmailDeliveryConfigurationStatus();
  }

  async sendRawEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ status: "SENT" | "SKIPPED" | "FAILED"; reason?: string; messageId?: string }> {
    const debugTo = getDebugRedirectTo();
    const actualTo = debugTo ?? params.to;

    if (!isEmailEnabled()) {
      console.info("[email] raw email send skipped (EMAIL_ENABLED is not true)", {
        kind: "notification",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        subject: params.subject,
      });
      return { status: "SKIPPED", reason: "EMAIL_DISABLED" };
    }

    const missingKeys = getMissingResendEnvKeys();
    if (missingKeys.length > 0) {
      console.warn("[email] raw email send skipped: missing required env", {
        intendedTo: params.to,
        actualTo,
        subject: params.subject,
        missingKeys,
        environment: process.env.NODE_ENV,
      });
      return { status: "SKIPPED", reason: "EMAIL_NOT_CONFIGURED" };
    }

    try {
      const result = await sendViaResend({
        kind: "notification",
        intendedTo: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { status: "SENT", messageId: result.messageId ?? undefined };
    } catch (error) {
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "EMAIL_SEND_FAILED";
      console.error("[email] raw email send failed", {
        intendedTo: params.to,
        actualTo,
        subject: params.subject,
        reason,
      });
      return { status: "FAILED", reason };
    }
  }

  async sendNotificationEmail(params: {
    to: string;
    subject: string;
    title: string;
    body: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
  }): Promise<{ status: "SENT" | "SKIPPED" | "FAILED"; reason?: string; messageId?: string }> {
    const debugTo = getDebugRedirectTo();
    const actualTo = debugTo ?? params.to;

    if (!isEmailEnabled()) {
      console.info("[email] notification send skipped (EMAIL_ENABLED is not true)", {
        kind: "notification",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        subject: params.subject,
      });
      return { status: "SKIPPED", reason: "EMAIL_DISABLED" };
    }

    const missingKeys = getMissingResendEnvKeys();
    if (missingKeys.length > 0) {
      console.warn("[email] notification send skipped: missing required env", {
        intendedTo: params.to,
        actualTo,
        subject: params.subject,
        missingKeys,
        environment: process.env.NODE_ENV,
      });
      return { status: "SKIPPED", reason: "EMAIL_NOT_CONFIGURED" };
    }

    try {
      const result = await sendViaResend({
        kind: "notification",
        intendedTo: params.to,
        subject: params.subject,
        react: (
          <TransactionalNotificationTemplate
            title={params.title}
            body={params.body}
            ctaLabel={params.ctaLabel}
            ctaUrl={params.ctaUrl}
          />
        ),
      });

      return { status: "SENT", messageId: result.messageId ?? undefined };
    } catch (error) {
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "EMAIL_SEND_FAILED";
      console.error("[email] notification send failed", {
        intendedTo: params.to,
        actualTo,
        subject: params.subject,
        reason,
      });
      return { status: "FAILED", reason };
    }
  }

  async sendVerifyEmail(params: { to: string; token: string }): Promise<void> {
    const debugTo = getDebugRedirectTo();
    const actualTo = debugTo ?? params.to;

    console.info("[email] sendVerifyEmail called", {
      event: "send_verify_email_invoked",
      intendedTo: params.to,
      actualTo,
      tokenPresent: Boolean(params.token),
      EMAIL_ENABLED: process.env.EMAIL_ENABLED,
      RESEND_API_KEY_present: Boolean(process.env.RESEND_API_KEY?.trim()),
      EMAIL_FROM_present: Boolean(process.env.EMAIL_FROM?.trim()),
      EMAIL_REPLY_TO_present: Boolean(process.env.EMAIL_REPLY_TO?.trim()),
      APP_PUBLIC_URL_present: Boolean(process.env.APP_PUBLIC_URL?.trim()),
      debugRedirect: Boolean(debugTo),
    });

    if (!isEmailEnabled()) {
      console.warn("[email] ⚠️ SEND SKIPPED: EMAIL_ENABLED is not 'true'", {
        kind: "verify-email",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        subject: EMAIL_SUBJECTS.verifyEmail,
        hint: "Set EMAIL_ENABLED=true in .env to enable email delivery",
      });
      return;
    }

    const verifyUrl = buildVerifyEmailUrl(params.token);
    await sendViaResend({
      kind: "verify-email",
      intendedTo: params.to,
      subject: EMAIL_SUBJECTS.verifyEmail,
      react: <VerifyEmailTemplate verifyUrl={verifyUrl} />,
    });
  }

  async sendPasswordResetEmail(params: { to: string; token: string }): Promise<void> {
    const debugTo = getDebugRedirectTo();
    const actualTo = debugTo ?? params.to;

    if (!isEmailEnabled()) {
      console.info("[email] send skipped (EMAIL_ENABLED is not true)", {
        kind: "password-reset",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        subject: EMAIL_SUBJECTS.passwordReset,
      });
      return;
    }

    const resetUrl = buildPasswordResetUrl(params.token);
    await sendViaResend({
      kind: "password-reset",
      intendedTo: params.to,
      subject: EMAIL_SUBJECTS.passwordReset,
      react: <PasswordResetTemplate resetUrl={resetUrl} />,
    });
  }

  async sendWelcomeEmail(params: {
    to: string;
    userId: string;
    userName?: string | null;
    ctaUrl?: string;
  }): Promise<void> {
    const debugTo = getDebugRedirectTo();
    const actualTo = debugTo ?? params.to;

    if (!isEmailEnabled()) {
      console.info("[email] send skipped (EMAIL_ENABLED is not true)", {
        kind: "welcome",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        subject: EMAIL_SUBJECTS.welcome,
      });
      return;
    }

    // WELCOME is transactional — always sent, no marketingEmailsEnabled check

    assertConfiguredForResend();

    await sendViaResend({
      kind: "welcome",
      intendedTo: params.to,
      subject: EMAIL_SUBJECTS.welcome,
      react: <MamagoWelcomeTemplate ctaUrl={params.ctaUrl} />,
    });
  }

  async sendBusinessInvite(params: {
    to: string;
    businessName: string;
    inviterName?: string | null;
    acceptUrl: string;
    expiresInDays: number;
  }): Promise<void> {
    const debugTo = getDebugRedirectTo();
    const actualTo = debugTo ?? params.to;

    if (!isEmailEnabled()) {
      console.warn("[email] ⚠️ SEND SKIPPED: EMAIL_ENABLED is not 'true'", {
        kind: "business-invite",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        subject: EMAIL_SUBJECTS.businessInvite,
        hint: "Set EMAIL_ENABLED=true in .env to enable email delivery",
      });
      return;
    }

    await sendViaResend({
      kind: "business-invite",
      intendedTo: params.to,
      subject: EMAIL_SUBJECTS.businessInvite,
      react: (
        <BusinessInviteTemplate
          businessName={params.businessName}
          inviterName={params.inviterName}
          acceptUrl={params.acceptUrl}
          expiresInDays={params.expiresInDays}
        />
      ),
    });
  }
}

export const emailService = new EmailService();

function TransactionalNotificationTemplate(props: {
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}) {
  return (
    <html>
      <body
        style={{
          fontFamily: "Arial, sans-serif",
          maxWidth: 560,
          margin: "0 auto",
          padding: 24,
          color: "#1F1F1F",
        }}
      >
        <h2 style={{ marginBottom: 8 }}>{props.title}</h2>
        <p style={{ color: "#555", lineHeight: 1.6 }}>{props.body}</p>
        {props.ctaUrl ? (
          <p style={{ marginTop: 20 }}>
            <a
              href={props.ctaUrl}
              style={{
                display: "inline-block",
                background: "#EF8759",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              {props.ctaLabel || "Открыть"}
            </a>
          </p>
        ) : null}
        <hr style={{ marginTop: 32, border: "none", borderTop: "1px solid #eee" }} />
        <p style={{ fontSize: 12, color: "#aaa" }}>mamaGo — семейный помощник</p>
      </body>
    </html>
  );
}
