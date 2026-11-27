import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { hashCode, safeEq } from "@/lib/otp/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { resetRateLimit } from "@/lib/security/rateLimit";
import { checkActivationRateLimit } from "@/server/auth/activationRateLimit";
import { createHmac } from "node:crypto";
import prisma from "@/lib/prisma";
import { completeOnboardingNotification } from "@/server/services/notification.service";
import { getTrustedClientIp } from "@/lib/security/clientIp";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
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

    const codeStr = typeof code === "string" ? code : "";
    if (!/^\d{4}$/.test(codeStr)) {
      return NextResponse.json({ error: "Код должен быть 4 цифры" }, { status: 400 });
    }

    // Rate limit check: 5 attempts per 10 minutes per IP + Phone
    const ip = getTrustedClientIp(request) ?? "unknown";
    const secret = process.env.OTP_SECRET;
    if (!secret || secret === "YOUR_SECRET_HERE") throw new Error("OTP_SECRET is not configured");
    const rateLimitKey = `otp_verify:v2:${createHmac("sha256", secret).update(JSON.stringify([ip, phoneE164])).digest("hex")}`;
    const rl = await checkActivationRateLimit({ key: rateLimitKey, limit: 5, windowMs: 10 * 60 * 1000 });
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
    // Compare-and-swap against the exact OTP snapshot, including resend state.
    const snapshot = {
      id: otpRecord.id,
      codeHash: otpRecord.codeHash,
      lastSentAt: otpRecord.lastSentAt,
      expiresAt: otpRecord.expiresAt,
      attempts: otpRecord.attempts,
    };
    const staleResponse = () => NextResponse.json(
      { error: "Код изменился. Повторите попытку или запросите новый код" },
      { status: 400 }
    );

    if (otpRecord.expiresAt <= now || otpRecord.attempts >= 3) {
      await prisma.phoneOtp.deleteMany({ where: snapshot });
      return NextResponse.json({ error: "Код недействителен. Запросите новый" }, { status: 400 });
    }

    if (!safeEq(hashCode(codeStr), otpRecord.codeHash)) {
      const updated = await prisma.phoneOtp.updateMany({
        where: { ...snapshot, attempts: { lt: 3 }, expiresAt: { equals: otpRecord.expiresAt, gt: new Date() } },
        data: { attempts: { increment: 1 } },
      });
      if (updated.count !== 1) return staleResponse();
      return NextResponse.json(
        { error: "Неверный код" },
        { status: 400 }
      );
    }

    const isStub = user.email?.endsWith("@pending.mamago.by") ?? false;
    const consumed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.phoneOtp.deleteMany({
        where: { ...snapshot, expiresAt: { equals: otpRecord.expiresAt, gt: new Date() } },
      });
      if (deleted.count !== 1) return false;
      const activate = purpose === "REGISTER" && isStub && user.status === "PENDING_ACTIVATION";
      const updated = await tx.user.updateMany({
        where: { id: user.id, phoneE164, deletedAt: null, status: activate ? "PENDING_ACTIVATION" : { in: ["ACTIVE", "LIMITED"] } },
        data: { phoneVerifiedAt: now, ...(activate ? { status: "ACTIVE" as const } : {}) },
      });
      return updated.count === 1;
    });
    if (!consumed) return staleResponse();

    // Reset rate limiter on successful verification
    await resetRateLimit(rateLimitKey);

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
