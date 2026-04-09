import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/email";
import type { User } from "@prisma/client";
import { sendRegistrationVerificationEmail } from "@/server/auth/email-verification";

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "EMAIL_ALREADY_EXISTS" | "INVALID_CREDENTIALS" | "INVALID_TOKEN"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Register a new user
 * @throws AuthError with code "EMAIL_ALREADY_EXISTS" if email is taken
 * @throws ZodError if validation fails
 */
export async function registerUser(
  email: string,
  password: string
): Promise<{ user: User; sessionToken: string; verificationEmailSendFailed?: true }> {
  // Validate input
  const validated = registerSchema.parse({ email, password });

  // Normalize email (trim + lowercase)
  const normalizedEmail = normalizeEmail(validated.email);

  // Check if user exists (case-insensitive)
  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
  });

  if (existing) {
    throw new AuthError("Аккаунт с таким email уже существует", "EMAIL_ALREADY_EXISTS");
  }

  // Hash password
  const passwordHash = await hashPassword(validated.password);

  try {
    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: "USER",
      },
    });

    console.info("[auth] user registered successfully", {
      event: "registration_completed",
      userId: user.id,
      email: user.email,
    });

    const emailResult = await sendRegistrationVerificationEmail(user.id, user.email);

    // Create session
    const sessionToken = await createSession(user.id);

    return {
      user,
      sessionToken,
      ...(emailResult.verificationEmailSendFailed ? { verificationEmailSendFailed: true } : {}),
    };
  } catch (error) {
    // Handle unique constraint violation (race condition safety net)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AuthError("Аккаунт с таким email уже существует", "EMAIL_ALREADY_EXISTS");
      }
    }
    throw error;
  }
}
