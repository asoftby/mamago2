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
    // Never accept a request that we cannot safely rate-limit by trusted IP.
    // Report a generic service failure rather than claiming a link was sent.
    // This is identical for known and unknown accounts (no email oracle).
    return NextResponse.json(
      { accepted: false, message: "Активация временно недоступна. Попробуйте позже." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  await requestMigratedAccountActivationByEmail({ email, ip, source: "MANUAL_REQUEST" });

  return acceptedResponse(startedAt);
}
