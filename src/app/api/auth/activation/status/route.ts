import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  activationRateLimitKey,
  checkActivationRateLimit,
} from "@/server/auth/activationRateLimit";
import { checkActivationTokenStatus } from "@/server/auth/activationTokenStatus";
import {
  readSizeLimitedJson,
  trustedClientIp,
} from "@/server/auth/activationHttpSecurity";

export const runtime = "nodejs";

const statusSchema = z.object({ token: z.string().min(1).max(512) }).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  let parsed: z.infer<typeof statusSchema>;
  try {
    parsed = statusSchema.parse(await readSizeLimitedJson(request, 1024));
  } catch {
    return NextResponse.json({ status: "INVALID" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const ip = trustedClientIp(request);
  if (!ip) {
    return NextResponse.json({ status: "INVALID" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  // Same rate-limit shape as /complete's token-scoped limiter — this is a
  // read, but still one guess per request against a secret token value.
  const [ipLimit, tokenLimit] = await Promise.all([
    checkActivationRateLimit({
      key: activationRateLimitKey("status-ip", ip),
      limit: 20,
      windowMs: 15 * 60 * 1000,
    }),
    checkActivationRateLimit({
      key: activationRateLimitKey("status-token", parsed.token),
      limit: 5,
      windowMs: 15 * 60 * 1000,
    }),
  ]);
  if (!ipLimit.allowed || !tokenLimit.allowed) {
    return NextResponse.json({ status: "INVALID" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const status = await checkActivationTokenStatus(parsed.token);
  return NextResponse.json({ status }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
