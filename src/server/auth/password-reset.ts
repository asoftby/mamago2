import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { emailService } from "@/features/email/server/email-service";
import { AuthError } from "./register";

const requestResetSchema = z.object({
  email: z.string().email("Некорректный email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
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
  });

  // If user not found, silently succeed (don't reveal if email exists)
  if (!user) {
    console.log(`[Password Reset] Email not found: ${normalizedEmail}`);
    return;
  }

  // Generate secure random token
  const resetToken = crypto.randomUUID();

  // Set expiration (1 hour from now)
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

  // Save token to database
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpires,
    },
  });

  try {
    await emailService.sendPasswordResetEmail({
      to: normalizedEmail,
      token: resetToken,
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

  // Find user by token
  const user = await prisma.user.findFirst({
    where: {
      resetToken: validated.token,
    },
  });

  if (!user) {
    throw new AuthError("Invalid or expired reset token", "INVALID_TOKEN");
  }

  // Check expiration
  if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    throw new AuthError("Invalid or expired reset token", "INVALID_TOKEN");
  }

  // Hash new password
  const passwordHash = await hashPassword(validated.password);

  // Update user: set new password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
    },
  });
}
