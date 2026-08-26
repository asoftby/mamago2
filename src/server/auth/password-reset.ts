import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { generateRawToken, hashToken } from "@/lib/auth/tokenHash";
import {
  PASSWORD_RESET_RATE_LIMIT_MAX,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "@/lib/auth/passwordResetPolicy";
import { passwordSchema } from "@/lib/auth/passwordPolicy";
import { isSessionEligibleAccount } from "@/lib/auth/accountEligibility";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { isProductionAppEnv } from "@/lib/config/productionEnvGuard";
import { emailService } from "@/features/email/server/email-service";
import { AuthError } from "./register";

const requestResetSchema = z.object({
  email: z.string().email("Некорректный email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: passwordSchema,
});

function getPasswordResetRateLimitFingerprint(email: string): string {
  return hashToken(email);
}

async function createPasswordResetEmailDeliveryAudit(params: {
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
          kind: "password-reset",
          debugRedirect: params.debugRedirect,
        },
      },
      select: { id: true },
    });

    return delivery.id;
  } catch (error) {
    console.error("[Password Reset] failed to create email delivery audit", {
      userId: params.userId,
      error,
    });
    return null;
  }
}

async function finishPasswordResetEmailDeliveryAudit(params: {
  deliveryId: string | null;
  userId: string;
  status: "SENT" | "SKIPPED" | "FAILED";
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
    console.error("[Password Reset] failed to finalize email delivery audit", {
      userId: params.userId,
      deliveryId: params.deliveryId,
      status: params.status,
      error,
    });
  }
}

/**
 * Request password reset.
 *
 * The public flow intentionally behaves the same for existing, missing and
 * rate-limited accounts so an attacker cannot enumerate registered emails.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const validated = requestResetSchema.parse({ email });
  const normalizedEmail = validated.email.toLowerCase().trim();
  const fingerprint = getPasswordResetRateLimitFingerprint(normalizedEmail);

  // One actual send per minute prevents accidental double-clicks / mail spam.
  // Check this first so blocked clicks do not consume the longer 15-minute quota.
  const cooldown = await checkRateLimit(
    `password-reset:cooldown:${fingerprint}`,
    1,
    PASSWORD_RESET_RESEND_COOLDOWN_SECONDS * 1000,
  );
  if (!cooldown.allowed) {
    return;
  }

  const window = await checkRateLimit(
    `password-reset:window:${fingerprint}`,
    PASSWORD_RESET_RATE_LIMIT_MAX,
    PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  );
  if (!window.allowed) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, status: true, deletedAt: true },
  });

  // Unknown and ineligible accounts are indistinguishable publicly. Pending
  // migrated users must activate instead of establishing a password via reset.
  if (!user || !isSessionEligibleAccount(user)) {
    return;
  }

  const rawToken = generateRawToken();
  const resetToken = hashToken(rawToken);
  const resetTokenExpires = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpires,
    },
  });

  const emailHealth = emailService.getHealth();
  const deliveryId = await createPasswordResetEmailDeliveryAudit({
    userId: user.id,
    debugRedirect: emailHealth.debugRedirect,
  });

  if (!emailHealth.enabled) {
    await finishPasswordResetEmailDeliveryAudit({
      deliveryId,
      userId: user.id,
      status: "SKIPPED",
      errorMessage: "EMAIL_DISABLED",
    });
    console.warn("[Password Reset] email send skipped: EMAIL_DISABLED", {
      userId: user.id,
    });
    return;
  }

  if (!emailHealth.configured) {
    await finishPasswordResetEmailDeliveryAudit({
      deliveryId,
      userId: user.id,
      status: "SKIPPED",
      errorMessage: "EMAIL_NOT_CONFIGURED",
    });
    console.error("[Password Reset] email send skipped: EMAIL_NOT_CONFIGURED", {
      userId: user.id,
      missingKeys: emailHealth.missingKeys,
    });
    return;
  }

  if (isProductionAppEnv() && emailHealth.debugRedirect) {
    await finishPasswordResetEmailDeliveryAudit({
      deliveryId,
      userId: user.id,
      status: "SKIPPED",
      errorMessage: "EMAIL_DEBUG_REDIRECT_ACTIVE_IN_PROD",
    });
    console.error("[Password Reset] email send blocked: debug redirect is active in production", {
      userId: user.id,
    });
    return;
  }

  try {
    // Only the raw token leaves the server; the database stores its SHA-256 hash.
    await emailService.sendPasswordResetEmail({
      to: normalizedEmail,
      token: rawToken,
    });

    await finishPasswordResetEmailDeliveryAudit({
      deliveryId,
      userId: user.id,
      status: "SENT",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "EMAIL_SEND_FAILED";
    await finishPasswordResetEmailDeliveryAudit({
      deliveryId,
      userId: user.id,
      status: "FAILED",
      errorMessage,
    });

    // Do not include the email address in logs.
    console.error("[Password Reset] sendPasswordResetEmail failed", {
      userId: user.id,
      error,
    });
  }
}

/**
 * Cheap server-side preflight for the reset page. resetPassword() performs the
 * same validation again inside a serializable transaction, so this is UX only
 * and never the final authorization check.
 */
export async function isPasswordResetTokenValid(token: string): Promise<boolean> {
  const parsed = z.string().min(1).safeParse(token);
  if (!parsed.success) {
    return false;
  }

  const resetToken = hashToken(parsed.data);
  const user = await prisma.user.findFirst({
    where: {
      resetToken,
      resetTokenExpires: { gt: new Date() },
    },
    select: {
      status: true,
      deletedAt: true,
    },
  });

  return Boolean(user && isSessionEligibleAccount(user));
}

/**
 * Reset password using token.
 * @throws AuthError with code "INVALID_TOKEN" if token is invalid or expired
 * @throws ZodError if validation fails
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const validated = resetPasswordSchema.parse({ token, password: newPassword });
  const hashedToken = hashToken(validated.token);

  // Reject invalid/expired tokens before doing expensive password hashing.
  if (!(await isPasswordResetTokenValid(validated.token))) {
    throw new AuthError("Invalid or expired reset token", "INVALID_TOKEN");
  }

  const passwordHash = await hashPassword(validated.password);

  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findFirst({
        where: { resetToken: hashedToken },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          resetTokenExpires: true,
        },
      });

      if (
        !user ||
        !isSessionEligibleAccount(user) ||
        !user.resetTokenExpires ||
        user.resetTokenExpires < new Date()
      ) {
        throw new AuthError("Invalid or expired reset token", "INVALID_TOKEN");
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExpires: null,
        },
      });

      // A password reset is a security boundary: all previously issued sessions
      // must stop working, including sessions on other devices.
      await tx.session.deleteMany({ where: { userId: user.id } });
    },
    { isolationLevel: "Serializable" },
  );
}
