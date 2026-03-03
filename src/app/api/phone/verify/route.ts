import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { hashCode, safeEq } from "@/lib/otp/otp";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phone, code4, purpose } = body;

    // Validate purpose
    if (purpose !== "BUSINESS_PHONE_VERIFY") {
      return NextResponse.json(
        { ok: false, error: "Неверный purpose" },
        { status: 400 }
      );
    }

    // Validate code format
    if (!code4 || typeof code4 !== "string" || code4.length !== 4) {
      return NextResponse.json(
        { ok: false, error: "Неверный формат кода" },
        { status: 400 }
      );
    }

    // Normalize phone
    const phoneE164 = normalizePhoneToE164(phone);
    if (!/^\+\d{7,15}$/.test(phoneE164)) {
      return NextResponse.json(
        { ok: false, error: "Неверный формат телефона" },
        { status: 400 }
      );
    }

    // Fetch OTP from database
    const otpRecord = await prisma.phoneOtp.findUnique({
      where: {
        userId_phoneE164_purpose: {
          userId: user.id,
          phoneE164,
          purpose,
        },
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { ok: false, error: "Код не найден или истек. Запросите новый код" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Check expiration
    if (otpRecord.expiresAt < now) {
      await prisma.phoneOtp.delete({ where: { id: otpRecord.id } });
      return NextResponse.json(
        { ok: false, error: "Код истек. Запросите новый код" },
        { status: 400 }
      );
    }

    // Check attempts (max 3)
    if (otpRecord.attempts >= 3) {
      await prisma.phoneOtp.delete({ where: { id: otpRecord.id } });
      return NextResponse.json(
        {
          ok: false,
          error: "Превышено количество попыток. Запросите новый код",
        },
        { status: 400 }
      );
    }

    // Verify code using timing-safe comparison
    const inputHash = hashCode(code4);
    const isValid = safeEq(inputHash, otpRecord.codeHash);

    if (!isValid) {
      // Increment attempts
      const newAttempts = otpRecord.attempts + 1;
      await prisma.phoneOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: newAttempts },
      });

      return NextResponse.json(
        {
          ok: false,
          error: `Неверный код. Осталось попыток: ${3 - newAttempts}`,
        },
        { status: 400 }
      );
    }

    // Code is correct - update user and business in transaction
    await prisma.$transaction(async (tx) => {
      // Update user phone
      await tx.user.update({
        where: { id: user.id },
        data: {
          phoneE164,
          phoneVerifiedAt: now,
        },
      });

      // Update business status - sync both status fields
      const business = await tx.business.findUnique({
        where: { ownerUserId: user.id },
      });

      if (business) {
        await tx.business.update({
          where: { id: business.id },
          data: {
            status: "PENDING_VERIFICATION", // Legacy field
            verificationStatus: "PENDING", // Canonical field
            submittedAt: now,
            phone: phoneE164,
          },
        });
      }

      // Delete OTP record
      await tx.phoneOtp.delete({ where: { id: otpRecord.id } });
    });

    return NextResponse.json({
      ok: true,
      message: "Телефон подтвержден",
    });
  } catch (error) {
    console.error("[phone/verify] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
