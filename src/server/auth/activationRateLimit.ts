import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type ActivationRateLimitResult = {
  allowed: boolean;
};

type RateLimitQuery = (params: {
  key: string;
  now: Date;
  nextResetAt: Date;
}) => Promise<number>;

export function activationRateLimitKey(namespace: string, value: string): string {
  const digest = createHash("sha256").update(value, "utf8").digest("hex");
  return `activation:${namespace}:${digest}`;
}

const postgresRateLimitQuery: RateLimitQuery = async ({ key, now, nextResetAt }) => {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
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
      RETURNING "count"
    `;
    return Number(rows[0]?.count ?? Number.POSITIVE_INFINITY);
};

export function createActivationRateLimiter(query: RateLimitQuery) {
  return async (params: {
    key: string;
    limit: number;
    windowMs: number;
    now?: Date;
  }): Promise<ActivationRateLimitResult> => {
    const now = params.now ?? new Date();
    const nextResetAt = new Date(now.getTime() + params.windowMs);
    try {
      const count = await query({ key: params.key, now, nextResetAt });
      return { allowed: Number.isFinite(count) && count <= params.limit };
    } catch {
      return { allowed: false };
    }
  };
}

/** Postgres-backed fixed window that fails closed on any limiter error. */
export const checkActivationRateLimit = createActivationRateLimiter(
  postgresRateLimitQuery,
);
