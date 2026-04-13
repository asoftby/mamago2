import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  normalizeBusinessContactVerificationPurpose,
} from "@/lib/phone-verification/businessContactVerification.shared";
import {
  loadBusinessContactOtpClientState,
  verifyBusinessContactVerificationCode,
} from "@/lib/phone-verification/businessContactVerification";
import { isBusinessContactOtpEscalationError } from "@/lib/phone-verification/businessContactOtpErrors";

export const runtime = "nodejs";

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
    const { phone, code4, purpose } = body;

    if (!normalizeBusinessContactVerificationPurpose(purpose)) {
      return NextResponse.json(
        { ok: false, error: "Неверный purpose" },
        { status: 400 }
      );
    }

    try {
      const result = await verifyBusinessContactVerificationCode({
        userId: user.id,
        phone,
        code: code4,
      });

      return NextResponse.json({
        ok: true,
        message: "Телефон подтвержден",
        phoneE164: result.phoneE164,
        verifiedAt: result.verifiedAt,
        otpState: result.otpState,
      });
    } catch (error) {
      console.error("[phone/verify] Error:", error);
      const otpState = await loadBusinessContactOtpClientState(user.id);

      if (isBusinessContactOtpEscalationError(error)) {
        const status =
          error.code === "OTP_SUPPORT"
            ? 403
            : error.code === "OTP_LOCKED"
              ? 429
              : 400;
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
        error instanceof Error ? error.message : "Внутренняя ошибка сервера";
      const status =
        errorMessage.includes("Код") ||
        errorMessage.includes("Неверный") ||
        errorMessage.includes("истёк") ||
        errorMessage.includes("не найден")
          ? 400
          : 500;
      return NextResponse.json(
        { ok: false, error: errorMessage, otpState },
        { status }
      );
    }
  } catch (error) {
    console.error("[phone/verify] Outer error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
