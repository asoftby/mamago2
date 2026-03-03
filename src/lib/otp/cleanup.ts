/**
 * OTP cleanup utilities
 * Server-only helpers for removing expired OTP records
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Delete all expired PhoneOtp records from database
 * @param prisma - Prisma client instance
 * @returns Number of deleted records
 */
export async function cleanupExpiredPhoneOtps(
  prisma: PrismaClient
): Promise<number> {
  const now = new Date();

  const result = await prisma.phoneOtp.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  return result.count;
}
