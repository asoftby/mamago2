/**
 * Postgres-backed fixed-window rate limiter (shared across instances).
 *
 * Storage is the primary Postgres database (RateLimitEntry table), so there is
 * no scenario where "the limiter store is down but the app is up" — any DB
 * error here means the protected operation would fail anyway. Individual
 * query failures still fail open (allow + error log) so a transient limiter
 * problem never locks users out.
 *
 * Semantics (kept identical to the previous in-memory implementation):
 * - first hit in a window creates the counter with resetAt = now + windowMs;
 * - subsequent hits increment the counter; the window is NOT extended;
 * - an expired row is reused as a fresh window;
 * - resetRateLimit deletes the key (reset-on-success for login / otp_verify).
 */

import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// Opportunistic cleanup of expired rows every 5 minutes per instance.
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupExpired(now: Date): void {
  void prisma.rateLimitEntry
    .deleteMany({ where: { resetAt: { lte: now } } })
    .catch((error) => {
      console.error("[rateLimit] cleanup failed", error);
    });
}

/**
 * Check if a request should be rate-limited.
 *
 * @param key Unique identifier (e.g. login:ip:email)
 * @param limit Max allowed attempts in the window
 * @param windowMs Time window in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);

  try {
    if (now.getTime() - lastCleanup > CLEANUP_INTERVAL) {
      lastCleanup = now.getTime();
      cleanupExpired(now);
    }

    // Single atomic statement: insert a fresh window, or increment the
    // existing one, or restart an expired one — safe under concurrency.
    const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitEntry" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${nextResetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitEntry"."resetAt" <= ${now} THEN 1
          ELSE "RateLimitEntry"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitEntry"."resetAt" <= ${now} THEN ${nextResetAt}
          ELSE "RateLimitEntry"."resetAt"
        END
      RETURNING "count", "resetAt"
    `;

    const count = Number(rows[0].count);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: rows[0].resetAt.getTime(),
    };
  } catch (error) {
    // Fail open: a limiter failure must not take down login/booking flows.
    console.error("[rateLimit] check failed, allowing request", error);
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: nextResetAt.getTime(),
    };
  }
}

/**
 * Reset rate limit counter for a specific key (e.g. after successful login).
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimitEntry.deleteMany({ where: { key } });
  } catch (error) {
    console.error("[rateLimit] reset failed", error);
  }
}
