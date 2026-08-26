import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken } from "@/lib/auth/tokenHash";
import { isProductionAppEnv } from "@/lib/config/productionEnvGuard";
import { emailService } from "@/features/email/server/email-service";

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
/** Минимальный интервал между отправками письма подтверждения (resend). */
export const VERIFICATION_EMAIL_RESEND_COOLDOWN_MS = 60_000;

type VerificationDeliveryStatus = "SENT" | "SKIPPED" | "FAILED";

async function recordVerificationEmailSentAt(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastVerificationEmailSentAt: new Date() },
  });
}

async function createVerificationEmailDeliveryAudit(params: {
  userId: string;
  debugRedirect: boolean;
}): Promise<string | null> {
  try {
    const delivery = await prisma.notificationDelivery.create({
      data: {
        userId: params.userId,
        channel: "EMAIL",
        status: "PENDING",
        attemptCount: 1,
        payloadJson: {
          source: "auth",
          kind: "verify-email",
          debugRedirect: params.debugRedirect,
        },
      },
      select: { id: true },
    });
    return delivery.id;
  } catch (error) {
    console.error("[auth] failed to create verification email delivery audit", {
      userId: params.userId,
      error,
    });
    return null;
  }
}

async function finishVerificationEmailDeliveryAudit(params: {
  deliveryId: string | null;
  userId: string;
  status: VerificationDeliveryStatus;
  errorMessage?: string | null;
}): Promise<void> {
  if (!params.deliveryId) return;

  try {
    await prisma.notificationDelivery.update({
      where: { id: params.deliveryId },
      data: {
        status: params.status,
        errorMessage:
          params.status === "SENT"
            ? null
            : params.errorMessage ?? "EMAIL_SEND_FAILED",
        sentAt: params.status === "SENT" ? new Date() : null,
      },
    });
  } catch (error) {
    console.error("[auth] failed to finalize verification email delivery audit", {
      userId: params.userId,
      deliveryId: params.deliveryId,
      status: params.status,
      error,
    });
  }
}

function getEmailConfigurationFailure(): {
  reason: "EMAIL_DISABLED" | "EMAIL_NOT_CONFIGURED" | "EMAIL_DEBUG_REDIRECT_ACTIVE_IN_PROD";
  missingKeys?: string[];
} | null {
  const health = emailService.getHealth();
  if (!health.enabled) return { reason: "EMAIL_DISABLED" };
  if (!health.configured) {
    return { reason: "EMAIL_NOT_CONFIGURED", missingKeys: health.missingKeys };
  }
  if (isProductionAppEnv() && health.debugRedirect) {
    return { reason: "EMAIL_DEBUG_REDIRECT_ACTIVE_IN_PROD" };
  }
  return null;
}

export async function issueEmailVerificationForUser(
  userId: string,
): Promise<{ token: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (user?.emailVerifiedAt) {
    return null;
  }

  const rawToken = generateRawToken();

  // Hash the token before storing in DB (defense-in-depth)
  const token = hashToken(rawToken);

  const emailVerificationExpires = new Date(Date.now() + VERIFY_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerificationToken: token, emailVerificationExpires },
  });

  // Return raw (unhashed) token so it can be sent to the user via email
  return { token: rawToken };
}

export async function sendRegistrationVerificationEmail(
  userId: string,
  email: string,
): Promise<{ verificationEmailSendFailed: boolean }> {
  console.info("[auth] sendRegistrationVerificationEmail called", {
    event: "verify_email_send_started_after_registration",
    userId,
  });

  let deliveryId: string | null = null;

  try {
    const issued = await issueEmailVerificationForUser(userId);
    if (!issued) {
      console.info("[auth] verification email skipped (email already verified)", { userId });
      return { verificationEmailSendFailed: false };
    }

    const health = emailService.getHealth();
    deliveryId = await createVerificationEmailDeliveryAudit({
      userId,
      debugRedirect: health.debugRedirect,
    });

    const configurationFailure = getEmailConfigurationFailure();
    if (configurationFailure) {
      await finishVerificationEmailDeliveryAudit({
        deliveryId,
        userId,
        status: "SKIPPED",
        errorMessage: configurationFailure.reason,
      });
      console.error("[auth] verification email not deliverable", {
        event: "verify_email_send_skipped_after_registration",
        userId,
        reason: configurationFailure.reason,
        ...(configurationFailure.missingKeys
          ? { missingKeys: configurationFailure.missingKeys }
          : {}),
      });
      return { verificationEmailSendFailed: true };
    }

    console.info("[auth] calling emailService.sendVerifyEmail", {
      event: "email_service_send_verify_called",
      userId,
      tokenPresent: Boolean(issued.token),
    });

    await emailService.sendVerifyEmail({ to: email, token: issued.token });
    await recordVerificationEmailSentAt(userId);
    await finishVerificationEmailDeliveryAudit({
      deliveryId,
      userId,
      status: "SENT",
    });

    console.info("[auth] verification email sent successfully", {
      event: "verify_email_sent_successfully",
      userId,
    });

    return { verificationEmailSendFailed: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    await finishVerificationEmailDeliveryAudit({
      deliveryId,
      userId,
      status: "FAILED",
      errorMessage: message,
    });
    console.error("[auth] verification email send failed", {
      event: "verify_email_send_failed_after_registration",
      userId,
      message,
      stack,
    });
    return { verificationEmailSendFailed: true };
  }
}

export type ResendVerificationResult =
  | { sent: true; alreadyVerified: false }
  | { sent: false; alreadyVerified: true }
  | { rateLimited: true };

/**
 * Повторная отправка письма подтверждения (авторизованный пользователь).
 * @throws если отправка не удалась или email-канал не настроен
 */
export async function resendVerificationEmailForUser(
  userId: string,
  email: string,
): Promise<ResendVerificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true, lastVerificationEmailSentAt: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.emailVerifiedAt) {
    return { sent: false, alreadyVerified: true };
  }

  if (user.lastVerificationEmailSentAt) {
    const elapsed = Date.now() - user.lastVerificationEmailSentAt.getTime();
    if (elapsed < VERIFICATION_EMAIL_RESEND_COOLDOWN_MS) {
      return { rateLimited: true };
    }
  }

  const issued = await issueEmailVerificationForUser(userId);
  if (!issued) {
    return { sent: false, alreadyVerified: true };
  }

  const health = emailService.getHealth();
  const deliveryId = await createVerificationEmailDeliveryAudit({
    userId,
    debugRedirect: health.debugRedirect,
  });
  const configurationFailure = getEmailConfigurationFailure();

  if (configurationFailure) {
    await finishVerificationEmailDeliveryAudit({
      deliveryId,
      userId,
      status: "SKIPPED",
      errorMessage: configurationFailure.reason,
    });
    throw new Error(configurationFailure.reason);
  }

  try {
    await emailService.sendVerifyEmail({ to: email, token: issued.token });
    await recordVerificationEmailSentAt(userId);
    await finishVerificationEmailDeliveryAudit({
      deliveryId,
      userId,
      status: "SENT",
    });
    return { sent: true, alreadyVerified: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "EMAIL_SEND_FAILED";
    await finishVerificationEmailDeliveryAudit({
      deliveryId,
      userId,
      status: "FAILED",
      errorMessage: message,
    });
    throw error;
  }
}

export type VerifyEmailResult =
  | { ok: true; userId: string; email: string; wasNewVerified: boolean }
  | { ok: false; reason: "invalid" | "expired" };

export async function verifyEmailByToken(token: string): Promise<VerifyEmailResult> {
  // Hash the incoming token before looking it up
  const hashedToken = hashToken(token);

  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: hashedToken },
  });

  if (!user) {
    return { ok: false, reason: "invalid" };
  }

  if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: null, emailVerificationExpires: null },
    });
    return { ok: false, reason: "expired" };
  }

  if (user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: null, emailVerificationExpires: null },
    });
    return { ok: true, userId: user.id, email: user.email, wasNewVerified: false };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return { ok: true, userId: user.id, email: user.email, wasNewVerified: true };
}
