/**
 * Simple in-memory rate limiter for MVP/local/single-instance production.
 * No Redis or external dependencies required.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const storage = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries to prevent memory leaks.
 * Called periodically or during rate limit checks.
 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of storage.entries()) {
    if (now >= entry.resetAt) {
      storage.delete(key);
    }
  }
}

// Run cleanup every 5 minutes if there's activity
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate-limited.
 * 
 * @param key Unique identifier (e.g. login:ip:email)
 * @param limit Max allowed attempts in the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanup();
    lastCleanup = now;
  }

  let entry = storage.get(key);

  // If entry exists but is expired, reset it
  if (entry && now >= entry.resetAt) {
    storage.delete(key);
    entry = undefined;
  }

  if (!entry) {
    // First attempt
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    storage.set(key, entry);
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count += 1;

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Reset rate limit counter for a specific key (e.g. after successful login).
 */
export function resetRateLimit(key: string): void {
  storage.delete(key);
}
