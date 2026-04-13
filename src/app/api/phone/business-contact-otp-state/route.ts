import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { loadBusinessContactOtpClientState } from "@/lib/phone-verification/businessContactVerification";

export const runtime = "nodejs";

/**
 * GET /api/phone/business-contact-otp-state
 * Текущее серверное состояние escalation OTP (business contact).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
  }

  const otpState = await loadBusinessContactOtpClientState(user.id);
  return NextResponse.json({ ok: true, otpState });
}
