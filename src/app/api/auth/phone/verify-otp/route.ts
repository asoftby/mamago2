import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { hashCode, safeEq } from "@/lib/otp/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rateLimit";
import prisma from "@/lib/prisma";
import { completeOnboardingNotification } from "@/server/services/notification.service";

export const runtime = "nodejs";

/**
 * Extracts client IP with support for Cloudflare and proxies.
 */
function getClientIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const real = request.headers.get("x-real-ip");
  if (real) return real;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code, purpose } = body;

    if (!phone || !code) {
      return NextResponse.json({ error: "Укажите телефон и код" }, { status: 400 });
    }
    if (purpose !== "LOGIN" && purpose !== "REGISTER") {
      return NextResponse.json({ error: "Неверный параметр purpose" }, { status: 400 });
    }

    const phoneE164 = normalizePhoneToE164(String(phone));
    if (!/^\+\d{7,15}$/.test(phoneE164)) {
      return NextResponse.json({ error: "Неверный формат телефона" }, { status: 400 });
    }

    const codeStr = String(code).replace(/\D/g, "");
    if (codeStr.length !== 4) {
      return NextResponse.json({ error: "Код должен быть 4 цифры" }, { status: 400 });
    }

    // Rate limit check: 5 attempts per 10 minutes per IP + Phone
    const ip = getClientIp(request);
    const rateLimitKey = `otp_verify:${ip}:${phoneE164}`;
    const rl = checkRateLimit(rateLimitKey, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findFirst({ where: { phoneE164 } });
    if (!user) {
      return NextResponse.json({ error: "Код не найден. Запросите новый" }, { status: 400 });
    }

    // OTP lookup is scoped by purpose — LOGIN OTP cannot verify REGISTER and vice versa
    const otpRecord = await prisma.phoneOtp.findUnique({
      where: {
        userId_phoneE164_purpose: { userId: user.id, phoneE164, purpose },
      },
    });

    if (!otpRecord) {
      return NextResponse.json({ error: "Код не найден. Запросите новый" }, { status: 400 });
    }

    const now = new Date();

    if (otpRecord.expiresAt < now) {
      await prisma.phoneOtp.delete({ where: { id: otpRecord.id } });
      return NextResponse.json({ error: "Код истёк. Запросите новый" }, { status: 400 });
    }

    if (otpRecord.attempts >= 3) {
      await prisma.phoneOtp.delete({ where: { id: otpRecord.id } });
      return NextResponse.json({ error: "Превышено количество попыток. Запросите новый код" }, { status: 400 });
    }

    const inputHash = hashCode(codeStr);
    const isValid = safeEq(inputHash, otpRecord.codeHash);

    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1;
      await prisma.phoneOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: newAttempts },
      });
      return NextResponse.json(
        { error: `Неверный код. Осталось попыток: ${3 - newAttempts}` },
        { status: 400 }
      );
    }

    // Code correct — finalize based on purpose
    const isStub = user.email?.endsWith("@pending.mamago.by") ?? false;

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { phoneVerifiedAt: now };
      if (purpose === "REGISTER" && isStub) {
        updateData.status = "ACTIVE";
      }
      await tx.user.update({ where: { id: user.id }, data: updateData });
      await tx.phoneOtp.delete({ where: { id: otpRecord.id } });
    });

    // Reset rate limiter on successful verification
    resetRateLimit(rateLimitKey);

    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true });
    const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    setSessionCookie(response, token, requestHost ?? undefined);

    try {
      await completeOnboardingNotification(user.id, "VERIFY_PHONE");
    } catch (notificationError) {
      console.error("[auth/phone/verify-otp] completeOnboardingNotification", notificationError);
    }

    return response;
  } catch (error) {
    console.error("[auth/phone/verify-otp]", error);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}
