import "server-only";
import type { ReactElement } from "react";

import MamagoWelcomeTemplate from "../../../../emails/mamago-welcome";
import PasswordResetTemplate from "../templates/password-reset";
import VerifyEmailTemplate from "../templates/verify-email";
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

type EmailKind = "verify-email" | "password-reset" | "welcome" | "notification";

async function sendViaResend(
  kind: EmailKind,
  intendedTo: string,
  subject: string,
  react: ReactElement,
): Promise<void> {
  assertConfiguredForResend();

  const debugTo = getDebugRedirectTo();
  const to = debugTo ?? intendedTo;
  const resend = getResendClient();
  const from = getFrom();
  const replyTo = getReplyTo();

  console.info("[email] sending", {
    kind,
    intendedTo,
    actualTo: to,
    debugRedirect: Boolean(debugTo),
    subject,
  });

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    replyTo: [replyTo],
    subject,
    react,
    tags: [{ name: "type", value: kind }],
  });

  if (error) {
    console.error("[email] Resend error", { kind, intendedTo, message: error.message });
    throw new Error(`Resend: ${error.message}`);
  }

  console.info("[email] sent", { kind, intendedTo, messageId: data?.id ?? null });
}

export class EmailService {
  async sendNotificationEmail(params: {
    to: string;
    subject: string;
    title: string;
    body: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
  }): Promise<{ status: "SENT" | "SKIPPED"; reason?: string }> {
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

    await sendViaResend(
      "notification",
      params.to,
      params.subject,
      <TransactionalNotificationTemplate
        title={params.title}
        body={params.body}
        ctaLabel={params.ctaLabel}
        ctaUrl={params.ctaUrl}
      />,
    );

    return { status: "SENT" };
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
      let verifyUrl: string | undefined;
      try {
        verifyUrl = buildVerifyEmailUrl(params.token);
      } catch {
        verifyUrl = undefined;
      }
      console.warn("[email] ⚠️ SEND SKIPPED: EMAIL_ENABLED is not 'true'", {
        kind: "verify-email",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        verifyUrl: verifyUrl ?? "(задайте APP_PUBLIC_URL для полной ссылки)",
        subject: EMAIL_SUBJECTS.verifyEmail,
        hint: "Set EMAIL_ENABLED=true in .env to enable email delivery",
      });
      return;
    }

    const verifyUrl = buildVerifyEmailUrl(params.token);
    console.info("[email] sending verify email via Resend", {
      intendedTo: params.to,
      actualTo,
      verifyUrl,
    });

    await sendViaResend(
      "verify-email",
      params.to,
      EMAIL_SUBJECTS.verifyEmail,
      <VerifyEmailTemplate verifyUrl={verifyUrl} />,
    );
  }

  async sendPasswordResetEmail(params: { to: string; token: string }): Promise<void> {
    const debugTo = getDebugRedirectTo();
    const actualTo = debugTo ?? params.to;

    if (!isEmailEnabled()) {
      let resetUrl: string | undefined;
      try {
        resetUrl = buildPasswordResetUrl(params.token);
      } catch {
        resetUrl = undefined;
      }
      console.info("[email] send skipped (EMAIL_ENABLED is not true)", {
        kind: "password-reset",
        intendedTo: params.to,
        actualTo,
        debugRedirect: Boolean(debugTo),
        resetUrl: resetUrl ?? "(задайте APP_PUBLIC_URL для полной ссылки)",
        subject: EMAIL_SUBJECTS.passwordReset,
      });
      return;
    }

    const resetUrl = buildPasswordResetUrl(params.token);
    await sendViaResend(
      "password-reset",
      params.to,
      EMAIL_SUBJECTS.passwordReset,
      <PasswordResetTemplate resetUrl={resetUrl} />,
    );
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

    await sendViaResend(
      "welcome",
      params.to,
      EMAIL_SUBJECTS.welcome,
      <MamagoWelcomeTemplate
        userName={params.userName ?? undefined}
        ctaUrl={params.ctaUrl}
      />,
    );
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
