import { z } from "zod";
import { hashPassword, isVerifiablePasswordHash, verifyPassword } from "@/lib/auth/crypto";
import { passwordSchema } from "@/lib/auth/passwordPolicy";
import prisma from "@/lib/prisma";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: passwordSchema.regex(
    /\d/u,
    "Пароль должен содержать хотя бы одну цифру",
  ),
});

export type ChangePasswordResult =
  | { changed: true }
  | { changed: false; reason: "PASSWORD_UNAVAILABLE" | "WRONG_CURRENT_PASSWORD" };

class PasswordChangedConcurrentlyError extends Error {}

export async function changePassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResult> {
  const input = changePasswordSchema.parse({
    currentPassword: params.currentPassword,
    newPassword: params.newPassword,
  });
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, passwordHash: true },
  });

  // Phone stubs (passwordHash === "") and service accounts (disabled sentinel)
  // have no real password — reject before verifyPassword ever sees the hash.
  if (!user?.passwordHash || !isVerifiablePasswordHash(user.passwordHash)) {
    return { changed: false, reason: "PASSWORD_UNAVAILABLE" };
  }

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    return { changed: false, reason: "WRONG_CURRENT_PASSWORD" };
  }

  const passwordHash = await hashPassword(input.newPassword);

  try {
    await prisma.$transaction(
      async (tx) => {
        // The old hash is part of the predicate so two concurrent changes cannot
        // both succeed after verifying the same current password.
        const updated = await tx.user.updateMany({
          where: { id: user.id, passwordHash: user.passwordHash },
          data: { passwordHash },
        });
        if (updated.count !== 1) {
          throw new PasswordChangedConcurrentlyError();
        }

        // Changing a password is an authentication boundary: revoke the current
        // browser and every other user session in the same atomic transaction.
        await tx.session.deleteMany({ where: { userId: user.id } });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof PasswordChangedConcurrentlyError) {
      return { changed: false, reason: "WRONG_CURRENT_PASSWORD" };
    }
    throw error;
  }

  return { changed: true };
}
