import crypto from "crypto";

/**
 * Generate a cryptographically secure random token.
 * Returns a 64-character hex string (32 bytes).
 */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token using SHA-256.
 * Returns a 64-character hex string.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
