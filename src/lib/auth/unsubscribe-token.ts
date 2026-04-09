/**
 * Unsubscribe Token Helper
 * 
 * Generates and verifies opaque tokens for email unsubscribe links.
 * Tokens are stored in DB and do not expose userId in URL.
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * Generate a secure random opaque token.
 * Returns 64 hex characters (32 bytes).
 */
function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create an opaque unsubscribe token for a user.
 * 
 * Token is stored in DB and mapped to userId.
 * Token does not expose userId in URL.
 * 
 * @param userId - User ID to create token for
 * @returns Opaque token string (64 hex chars)
 * 
 * @example
 * const token = await createUnsubscribeToken("user_123");
 * // Returns: "a1b2c3d4e5f6..." (random, does not contain userId)
 */
export async function createUnsubscribeToken(userId: string): Promise<string> {
  if (!userId || typeof userId !== "string") {
    throw new Error("userId must be a non-empty string");
  }

  // Generate random opaque token
  const token = generateOpaqueToken();

  // Store in DB
  await prisma.unsubscribeToken.create({
    data: {
      token,
      userId,
    },
  });

  return token;
}

/**
 * Verify and decode an unsubscribe token.
 * 
 * Looks up token in DB and returns associated userId.
 * Marks token as used (idempotent - can be used multiple times).
 * 
 * @param token - Opaque token to verify
 * @returns Object with userId if valid, null if invalid
 * 
 * @example
 * const result = await verifyUnsubscribeToken(token);
 * if (result) {
 *   console.log("Valid token for user:", result.userId);
 * } else {
 *   console.log("Invalid token");
 * }
 */
export async function verifyUnsubscribeToken(token: string): Promise<{ userId: string } | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    // Look up token in DB
    const record = await prisma.unsubscribeToken.findUnique({
      where: { token },
      select: { userId: true, usedAt: true },
    });

    if (!record) {
      return null;
    }

    // Mark as used (idempotent - safe to call multiple times)
    if (!record.usedAt) {
      await prisma.unsubscribeToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });
    }

    return { userId: record.userId };
  } catch (error) {
    console.error("[UnsubscribeToken] Error verifying token:", error);
    return null;
  }
}

/**
 * Clean up old used tokens (optional maintenance).
 * Removes tokens that were used more than 90 days ago.
 * 
 * This is optional - tokens can be kept indefinitely for audit trail.
 */
export async function cleanupOldUnsubscribeTokens(): Promise<number> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const result = await prisma.unsubscribeToken.deleteMany({
    where: {
      usedAt: {
        lt: ninetyDaysAgo,
      },
    },
  });

  return result.count;
}
