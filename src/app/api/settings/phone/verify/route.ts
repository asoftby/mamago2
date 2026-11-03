import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BUSINESS_PHONE_ALREADY_LINKED_MESSAGE,
  isBusinessPhoneUniqueViolation,
} from "@/lib/phone-verification/businessContactVerification.shared";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  normalizeBusinessContactPhone,
  verifyBusinessContactVerificationCode,
} from "@/lib/phone-verification/businessContactVerification";
import { isBusinessContactOtpEscalationError } from "@/lib/phone-verification/businessContactOtpErrors";
import { completeOnboardingNotification } from "@/server/services/notification.service";

export const runtime = "nodejs";

const verifyPhoneSchema = z.object({
  phone: z.string().min(1, "Укажите номер телефона"),
  code: z.string().regex(/^\d{4}$/u, "Введите 4-значный код"),
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
    const parsed = verifyPhoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Введите корректный код" },
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
        { ok: false, code: "PHONE_ALREADY_IN_USE", error: BUSINESS_PHONE_ALREADY_LINKED_MESSAGE },
        { status: 409 }
      );
    }

    const result = await verifyBusinessContactVerificationCode({
      userId: user.id,
      phone: phoneE164,
      code: parsed.data.code,
    });

    try {
      await completeOnboardingNotification(user.id, "VERIFY_PHONE");
    } catch (notificationError) {
      console.error("[settings/phone/verify] completeOnboardingNotification", notificationError);
    }

    return NextResponse.json({
      ok: true,
      phoneE164: result.phoneE164,
      verifiedAt: result.verifiedAt,
    });
  } catch (error) {
    if (isBusinessContactOtpEscalationError(error)) {
      const status =
        error.code === "OTP_SUPPORT"
          ? 403
          : error.code === "OTP_LOCKED"
            ? 429
            : 400;
      return NextResponse.json(
        { ok: false, error: error.message },
        { status }
      );
    }

    if (isBusinessPhoneUniqueViolation(error)) {
      return NextResponse.json(
        { ok: false, code: "PHONE_ALREADY_IN_USE", error: BUSINESS_PHONE_ALREADY_LINKED_MESSAGE },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Не удалось подтвердить номер";
    const status =
      message.includes("Код") ||
      message.includes("Неверный") ||
      message.includes("истёк") ||
      message.includes("не найден")
        ? 400
        : 500;

    if (status === 500) {
      console.error("[settings/phone/verify] Unexpected verification error:", error);
    }
    return NextResponse.json({
      ok: false,
      error: status === 400 ? message : "Не удалось подтвердить номер. Попробуйте позже.",
    }, { status });
  }
}
