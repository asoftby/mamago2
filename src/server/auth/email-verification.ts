import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken } from "@/lib/auth/tokenHash";
import { emailService } from "@/features/email/server/email-service";

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
/** Минимальный интервал между отправками письма подтверждения (resend). */
export const VERIFICATION_EMAIL_RESEND_COOLDOWN_MS = 60_000;

async function recordVerificationEmailSentAt(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastVerificationEmailSentAt: new Date() },
  });
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
    email,
  });

  try {
    const issued = await issueEmailVerificationForUser(userId);
    if (!issued) {
      console.info("[auth] verification email skipped (email already verified)", { userId });
      return { verificationEmailSendFailed: false };
    }

    console.info("[auth] calling emailService.sendVerifyEmail", {
      event: "email_service_send_verify_called",
      userId,
      email,
      tokenPresent: Boolean(issued.token),
    });

    await emailService.sendVerifyEmail({ to: email, token: issued.token });
    await recordVerificationEmailSentAt(userId);

    console.info("[auth] verification email sent successfully", {
      event: "verify_email_sent_successfully",
      userId,
      email,
    });

    return { verificationEmailSendFailed: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[auth] verification email send failed", {
      event: "verify_email_send_failed_after_registration",
      userId,
      email,
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
 * @throws если отправка не удалась при включённой доставке
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

  await emailService.sendVerifyEmail({ to: email, token: issued.token });
  await recordVerificationEmailSentAt(userId);
  return { sent: true, alreadyVerified: false };
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
