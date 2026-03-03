import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import type { User } from "@prisma/client";

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
): Promise<{ user: User; sessionToken: string }> {
  // Validate input
  const validated = registerSchema.parse({ email, password });

  // Normalize email
  const normalizedEmail = validated.email.toLowerCase().trim();

  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new AuthError("Email already registered", "EMAIL_ALREADY_EXISTS");
  }

  // Hash password
  const passwordHash = await hashPassword(validated.password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: "USER",
    },
  });

  // Create session
  const sessionToken = await createSession(user.id);

  return { user, sessionToken };
}
