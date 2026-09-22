import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { genCode4, hashCode } from "@/lib/otp/otp";
import { sendQuickSms } from "@/lib/sms/smsBy";
import prisma from "@/lib/prisma";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { checkActivationRateLimit } from "@/server/auth/activationRateLimit";
import {
  phoneOtpPublicHttpResponse,
  sendPhoneOtp,
  type PhoneOtpPurpose,
} from "@/server/auth/phoneOtpSend.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, purpose } = body;

    if (!phone) {
      return NextResponse.json({ error: "Укажите номер телефона" }, { status: 400 });
    }
    if (purpose !== "LOGIN" && purpose !== "REGISTER") {
      return NextResponse.json({ error: "Неверный параметр purpose" }, { status: 400 });
    }

    const phoneE164 = normalizePhoneToE164(String(phone));
    if (!/^\+\d{7,15}$/.test(phoneE164)) {
      return NextResponse.json({ error: "Неверный формат телефона" }, { status: 400 });
    }

    const callerIdentity = getTrustedClientIp(request) ?? "unknown";
    const result = await sendPhoneOtp(
      { phoneE164, callerIdentity, purpose: purpose as PhoneOtpPurpose },
      {
        checkRateLimit: checkActivationRateLimit,
        findUser: (normalizedPhone) =>
          prisma.user.findFirst({
            where: { phoneE164: normalizedPhone },
            select: { id: true, email: true },
          }),
        createOrGetStub: (normalizedPhone, phoneDigits) =>
          prisma.user.upsert({
            where: { email: `phone_${phoneDigits}@pending.mamago.by` },
            create: {
              email: `phone_${phoneDigits}@pending.mamago.by`,
              passwordHash: "",
              phoneE164: normalizedPhone,
            },
            update: { phoneE164: normalizedPhone },
            select: { id: true, email: true },
          }),
        storeOtp: async ({ userId, purpose: otpPurpose, codeHash, expiresAt, now }) => {
          await prisma.phoneOtp.upsert({
            where: {
              userId_phoneE164_purpose: {
                userId,
                phoneE164,
                purpose: otpPurpose,
              },
            },
            create: {
              userId,
              phoneE164,
              purpose: otpPurpose,
              codeHash,
              expiresAt,
              lastSentAt: now,
              attempts: 0,
            },
            update: { codeHash, expiresAt, lastSentAt: now, attempts: 0 },
          });
        },
        generateCode: genCode4,
        hashCode,
        sendSms: async (phoneDigits, code) => {
          if (process.env.NODE_ENV === "development" && process.env.FORCE_SMS !== "true") {
            console.info(`[OTP dev] send suppressed purpose=${purpose}`);
            return;
          }
          await sendQuickSms({ phoneDigits, message: `Ваш код: ${code}` });
        },
        logSecurityEvent: (event) => console.warn(`[security] ${event}`),
      },
    );

    const publicResponse = phoneOtpPublicHttpResponse(result);
    return NextResponse.json(publicResponse.body, { status: publicResponse.status });
  } catch (error) {
    console.error("[auth/phone/send-otp]", error);
    return NextResponse.json({ error: "Ошибка отправки кода" }, { status: 500 });
  }
}
