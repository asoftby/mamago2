import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { passwordSchema } from "@/lib/auth/passwordPolicy";
import {
  activationRateLimitKey,
  checkActivationRateLimit,
} from "@/server/auth/activationRateLimit";
import { completeMigratedAccountActivation } from "@/server/auth/activationCompletion.service";
import {
  readSizeLimitedJson,
  trustedClientIp,
} from "@/server/auth/activationHttpSecurity";

export const runtime = "nodejs";

const completeSchema = z
  .object({
    token: z.string().min(1).max(512),
    newPassword: passwordSchema,
  })
  .strict();

function invalidResponse(status = 400): NextResponse {
  return NextResponse.json(
    { error: "Invalid or expired activation request" },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let parsed: z.infer<typeof completeSchema>;
  try {
    parsed = completeSchema.parse(await readSizeLimitedJson(request, 2048));
  } catch {
    return invalidResponse();
  }

  const ip = trustedClientIp(request);
  if (!ip) {
    return invalidResponse(429);
  }
  const [ipLimit, tokenLimit] = await Promise.all([
    checkActivationRateLimit({
      key: activationRateLimitKey("complete-ip", ip),
      limit: 20,
      windowMs: 15 * 60 * 1000,
    }),
    checkActivationRateLimit({
      key: activationRateLimitKey("complete-token", parsed.token),
      limit: 5,
      windowMs: 15 * 60 * 1000,
    }),
  ]);
  if (!ipLimit.allowed || !tokenLimit.allowed) {
    return invalidResponse(429);
  }

  try {
    const result = await completeMigratedAccountActivation({
      token: parsed.token,
      password: parsed.newPassword,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    if (!result.completed) {
      return invalidResponse();
    }
    return NextResponse.json(
      { success: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return invalidResponse(503);
  }
}
