import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  normalizeBusinessContactPhone,
  verifyBusinessContactVerificationCode,
} from "@/lib/phone-verification/businessContactVerification";
import { isBusinessContactOtpEscalationError } from "@/lib/phone-verification/businessContactOtpErrors";

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
        { ok: false, error: "Этот номер уже привязан к другому аккаунту" },
        { status: 409 }
      );
    }

    const result = await verifyBusinessContactVerificationCode({
      userId: user.id,
      phone: phoneE164,
      code: parsed.data.code,
    });

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

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { ok: false, error: "Этот номер уже привязан к другому аккаунту" },
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

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
