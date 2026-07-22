import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/email";
import {
  activationRateLimitKey,
  checkActivationRateLimit,
} from "@/server/auth/activationRateLimit";
import { resolveActivationEmailDelivery } from "@/server/auth/activationEmailGate";
import {
  readSizeLimitedJson,
  trustedClientIp,
  waitForGenericResponseFloor,
} from "@/server/auth/activationHttpSecurity";
import { issueUserActionToken } from "@/server/auth/userActionToken.service";

export const runtime = "nodejs";

const requestSchema = z.object({ email: z.string().max(320) }).strict();
const GENERIC_RESPONSE = {
  accepted: true,
  message: "Если аккаунт подходит для активации, инструкции будут отправлены.",
};

async function acceptedResponse(startedAt: number): Promise<NextResponse> {
  await waitForGenericResponseFloor(startedAt);
  return NextResponse.json(GENERIC_RESPONSE, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = performance.now();
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await readSizeLimitedJson(request, 1024));
  } catch {
    return acceptedResponse(startedAt);
  }

  const email = normalizeEmail(parsed.email);
  if (!z.string().email().safeParse(email).success) {
    return acceptedResponse(startedAt);
  }
  const ip = trustedClientIp(request);
  if (!ip) {
    return acceptedResponse(startedAt);
  }
  const ipLimit = await checkActivationRateLimit({
    key: activationRateLimitKey("request-ip", ip),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  const emailLimit = await checkActivationRateLimit({
    key: activationRateLimitKey("request-email", email),
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return acceptedResponse(startedAt);
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) {
      return acceptedResponse(startedAt);
    }

    await issueUserActionToken({
      userId: user.id,
      purpose: "MIGRATED_ACCOUNT_ACTIVATION",
    });
    resolveActivationEmailDelivery();
  } catch {
    // The public response is deliberately identical for lookup, state,
    // limiter, issuance and delivery failures.
  }

  return acceptedResponse(startedAt);
}
