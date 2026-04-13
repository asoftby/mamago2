import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  normalizeBusinessContactPhone,
  sendBusinessContactVerificationCode,
} from "@/lib/phone-verification/businessContactVerification";
import { isBusinessContactOtpEscalationError } from "@/lib/phone-verification/businessContactOtpErrors";

export const runtime = "nodejs";

const sendPhoneOtpSchema = z.object({
  phone: z.string().min(1, "Укажите номер телефона"),
});

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
    const parsed = sendPhoneOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Укажите корректный номер телефона" },
        { status: 400 }
      );
    }

    const phoneE164 = normalizeBusinessContactPhone(parsed.data.phone);

    const existingOwner = await prisma.user.findFirst({
      where: {
        phoneE164,
        NOT: { id: user.id },
      },
      select: { id: true },
    });

    if (existingOwner) {
      return NextResponse.json(
        { ok: false, error: "Этот номер уже привязан к другому аккаунту" },
        { status: 409 }
      );
    }

    const result = await sendBusinessContactVerificationCode({
      userId: user.id,
      phone: phoneE164,
    });

    return NextResponse.json({
      ok: true,
      phoneE164,
      expiresAt: result.expiresAt,
      resendAfterSec: result.resendAfterSec,
      otpState: result.otpState,
    });
  } catch (error) {
    if (isBusinessContactOtpEscalationError(error)) {
      const status = error.code === "OTP_SUPPORT" ? 403 : 429;
      return NextResponse.json(
        { ok: false, error: error.message },
        { status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Не удалось отправить код";
    const status = message.includes("Повторная отправка через")
      ? 429
      : message.includes("Неверный формат")
        ? 400
        : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
