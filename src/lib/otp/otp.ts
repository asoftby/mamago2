/**
 * OTP generation and verification utilities
 * Uses HMAC-SHA256 for secure code hashing
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Generate a random 4-digit OTP code
 * @returns 4-digit code as string (e.g., "0123", "9876")
 */
export function genCode4(): string {
  const code = Math.floor(Math.random() * 10000);
  return code.toString().padStart(4, "0");
}

/**
 * Hash OTP code using HMAC-SHA256
 * @param code - Plain text OTP code
 * @returns Hex-encoded hash
 * @throws Error if OTP_SECRET is not configured
 */
export function hashCode(code: string): string {
  const secret = process.env.OTP_SECRET;

  if (!secret || secret === "YOUR_SECRET_HERE") {
    throw new Error(
      "OTP_SECRET environment variable is not configured. Please set a secure random string."
    );
  }

  return createHmac("sha256", secret).update(code).digest("hex");
}

/**
 * Safely compare two hashes using timing-safe comparison
 * Prevents timing attacks
 * @param a - First hash
 * @param b - Second hash
 * @returns true if hashes match
 */
export function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");

    if (bufA.length !== bufB.length) {
      return false;
    }

    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
