import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Same contract as the existing /api/cron/* routes: in production CRON_SECRET
 * is mandatory (503 without it) and the Bearer token must match (401);
 * elsewhere the secret is enforced only when one is configured. Returns a
 * response to send when the call must be rejected, or null when it may run.
 */
export function authorizeCronRequest(
  authHeader: string | null,
  env: Record<string, string | undefined> = process.env,
): NextResponse | null {
  const secret = env.CRON_SECRET?.trim();
  const isProduction = env.NODE_ENV === "production";

  if (isProduction && !secret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (!secret) return null;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader ?? "");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  return matches ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
