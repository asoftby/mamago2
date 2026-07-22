import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { generateRawToken, hashToken } from "@/lib/auth/tokenHash";
import { emailService } from "@/features/email/server/email-service";
import { AuthError } from "./register";
import { passwordSchema } from "@/lib/auth/passwordPolicy";
import { isSessionEligibleAccount } from "@/lib/auth/accountEligibility";

const requestResetSchema = z.object({
  email: z.string().email("Некорректный email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: passwordSchema,
});

/**
 * Request password reset
 * Silently succeeds even if email doesn't exist (security best practice)
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Validate input
  const validated = requestResetSchema.parse({ email });

  // Normalize email
  const normalizedEmail = validated.email.toLowerCase().trim();

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, status: true, deletedAt: true },
  });

  // Unknown and ineligible accounts are indistinguishable publicly. Pending
  // migrated users must activate instead of establishing a password via reset.
  if (!user || !isSessionEligibleAccount(user)) {
    return;
  }

  // Generate secure random token
  const rawToken = generateRawToken();

  // Hash the token before storing in DB (defense-in-depth)
  const resetToken = hashToken(rawToken);

  // Set expiration (1 hour from now)
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

  // Save hashed token to database
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpires,
    },
  });

  try {
    // Send raw (unhashed) token to user via email — this is the only time
    // the plaintext token is available outside the DB
    await emailService.sendPasswordResetEmail({
      to: normalizedEmail,
      token: rawToken,
    });
  } catch (e) {
    console.error("[Password Reset] sendPasswordResetEmail failed", {
      email: normalizedEmail,
      error: e,
    });
  }
}

/**
 * Reset password using token
 * @throws AuthError with code "INVALID_TOKEN" if token is invalid or expired
 * @throws ZodError if validation fails
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  // Validate input
  const validated = resetPasswordSchema.parse({ token, password: newPassword });

  // Hash the incoming token before looking it up
  const hashedToken = hashToken(validated.token);

  // Hash new password
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
    },
    { isolationLevel: "Serializable" },
  );
}
