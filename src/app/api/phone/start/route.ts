import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { genCode4, hashCode } from "@/lib/otp/otp";
import { sendQuickSms } from "@/lib/sms/smsBy";
import prisma from "@/lib/prisma";

// Force Node.js runtime
export const runtime = "nodejs";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_SEC = 60; // 60 seconds

/**
 * POST /api/phone/start
 * Request OTP code for phone verification
 * Supports resend with 60-second cooldown
 */
export async function POST(request: NextRequest) {
  try {
    // Auth required
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phone, purpose } = body;

    // Validate purpose
    if (purpose !== "BUSINESS_PHONE_VERIFY") {
      return NextResponse.json(
        { ok: false, error: "Неверный purpose" },
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

    const phoneDigits = phoneE164.replace(/\D/g, "");
    const now = new Date();

    // Look up existing OTP
    const existing = await prisma.phoneOtp.findUnique({
      where: {
        userId_phoneE164_purpose: {
          userId: user.id,
          phoneE164,
          purpose,
        },
      },
    });

    let code: string;
    let codeHash: string;
    let expiresAt: Date;

    if (existing) {
      // Check if expired
      if (existing.expiresAt < now) {
        // Expired - generate new code
        code = genCode4();
        codeHash = hashCode(code);
        expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

        await prisma.phoneOtp.update({
          where: { id: existing.id },
          data: {
            codeHash,
            expiresAt,
            lastSentAt: now,
            attempts: 0,
          },
        });
      } else {
        // Not expired - check cooldown
        const timeSinceLastSent =
          (now.getTime() - existing.lastSentAt.getTime()) / 1000;
        const remaining = RESEND_COOLDOWN_SEC - timeSinceLastSent;

        if (remaining > 0) {
          // Still in cooldown
          return NextResponse.json(
            {
              ok: false,
              error: `Повторная отправка через ${Math.ceil(remaining)} сек.`,
            },
            { status: 429 }
          );
        }

        // Cooldown passed - generate NEW code (we can't resend same code since we only store hash)
        code = genCode4();
        codeHash = hashCode(code);
        expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

        await prisma.phoneOtp.update({
          where: { id: existing.id },
          data: {
            codeHash,
            expiresAt,
            lastSentAt: now,
            attempts: 0,
          },
        });
      }
    } else {
      // Create new OTP
      code = genCode4();
      codeHash = hashCode(code);
      expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

      await prisma.phoneOtp.create({
        data: {
          userId: user.id,
          phoneE164,
          purpose,
          codeHash,
          expiresAt,
          lastSentAt: now,
          attempts: 0,
        },
      });
    }

    // Send SMS
    const message = `mamaGo.by: код ${code}`;

    try {
      await sendQuickSms({ phoneDigits, message });

      return NextResponse.json({
        ok: true,
        expiresAt: expiresAt.toISOString(),
        resendAfterSec: RESEND_COOLDOWN_SEC,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Не удалось отправить SMS";
      return NextResponse.json(
        { ok: false, error: errorMessage },
        { status: 400 }
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
