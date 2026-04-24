import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import type { User } from "@prisma/client";
import { AuthError } from "./register";

const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Login user
 * @throws AuthError with code "INVALID_CREDENTIALS" if email/password is wrong
 * @throws ZodError if validation fails
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: User; sessionToken: string }> {
  // Validate input
  const validated = loginSchema.parse({ email, password });

  // Normalize email
  const normalizedEmail = validated.email.toLowerCase().trim();

  // Find user
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  // Verify password
  const isValid = await verifyPassword(validated.password, user.passwordHash);

  if (!isValid) {
    throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  // Create session
  const sessionToken = await createSession(user.id);

  return { user, sessionToken };
}
