import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/**
 * Sentinel hash for service accounts that must never authenticate by password
 * (e.g. auto-created event-organizer users).
 */
export const DISABLED_PASSWORD_HASH = "service-account-disabled";

/**
 * True when the stored hash can be checked against a password: a bcrypt hash
 * or a legacy scrypt `salt:key` pair. False for empty hashes (phone stubs
 * before complete-registration) and the disabled-account sentinel.
 */
export function isVerifiablePasswordHash(hash: string): boolean {
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return true;
  }
  const [salt, key] = hash.split(":");
  return Boolean(salt && key);
}

/**
 * Hash a password using bcrypt for new credentials.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyScryptPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    if (!salt || !key) {
      // Empty hash (phone stub), disabled sentinel, or malformed value —
      // never verifiable, and crypto.scrypt behaviour here is undefined.
      resolve(false);
      return;
    }
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString("hex"));
    });
  });
}

/**
 * Verify a password against a hash.
 * Supports new bcrypt hashes and legacy `salt:key` scrypt hashes.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return bcrypt.compare(password, hash);
  }

  return verifyScryptPassword(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
