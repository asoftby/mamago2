import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  normalizeBusinessContactVerificationPurpose,
} from "@/lib/phone-verification/businessContactVerification.shared";
import {
  loadBusinessContactOtpClientState,
  sendBusinessContactVerificationCode,
} from "@/lib/phone-verification/businessContactVerification";
import { isBusinessContactOtpEscalationError } from "@/lib/phone-verification/businessContactOtpErrors";

export const runtime = "nodejs";

/**
 * POST /api/phone/start
 * Request OTP code for phone verification
 * Supports resend with 60-second cooldown
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phone, purpose } = body;

    if (!normalizeBusinessContactVerificationPurpose(purpose)) {
      return NextResponse.json(
        { ok: false, error: "Неверный purpose" },
        { status: 400 }
      );
    }

    try {
      const result = await sendBusinessContactVerificationCode({
        userId: user.id,
        phone,
      });

      return NextResponse.json({
        ok: true,
        expiresAt: result.expiresAt,
        resendAfterSec: result.resendAfterSec,
        otpState: result.otpState,
      });
    } catch (error) {
      const otpState = await loadBusinessContactOtpClientState(user.id);

      if (isBusinessContactOtpEscalationError(error)) {
        const status = error.code === "OTP_SUPPORT" ? 403 : 429;
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            code: error.code,
            remainingMs: error.remainingMs,
            lockedUntil: error.lockedUntil?.toISOString(),
            otpState,
          },
          { status }
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : "Не удалось отправить SMS";
      const status = errorMessage.includes("Повторная отправка через")
        ? 429
        : 400;
      return NextResponse.json(
        { ok: false, error: errorMessage, otpState },
        { status }
      );
    }
  } catch (error) {
    console.error("Phone start error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
