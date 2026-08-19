import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/email";
import { requestMigratedAccountActivationByEmail } from "@/server/auth/activationRequestFlow";
import {
  readSizeLimitedJson,
  waitForGenericResponseFloor,
} from "@/server/auth/activationHttpSecurity";
import { getTrustedClientIp } from "@/lib/security/clientIp";

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
  const ip = getTrustedClientIp(request);
  if (!ip) {
    // Preserves the endpoint's original behavior: without a trusted proxy,
    // this anonymous, unauthenticated endpoint does nothing at all rather
    // than fall back to only email-scoped rate limiting.
    return acceptedResponse(startedAt);
  }

  await requestMigratedAccountActivationByEmail({ email, ip, source: "MANUAL_REQUEST" });

  return acceptedResponse(startedAt);
}
