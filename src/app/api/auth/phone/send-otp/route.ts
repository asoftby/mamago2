import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { genCode4, hashCode } from "@/lib/otp/otp";
import { sendQuickSms } from "@/lib/sms/smsBy";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 min
const RESEND_COOLDOWN_SEC = 60;

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

    const phoneDigits = phoneE164.replace(/\D/g, "");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    // Find existing real user by phone
    const existingUser = await prisma.user.findFirst({ where: { phoneE164 } });
    const isStub = existingUser?.email?.endsWith("@pending.mamago.by") ?? false;
    const isRealUser = !!existingUser && !isStub;

    if (purpose === "LOGIN") {
      if (!isRealUser) {
        return NextResponse.json(
          { error: "Аккаунт с этим номером не найден", hint: "register" },
          { status: 404 }
        );
      }
    }

    if (purpose === "REGISTER") {
      if (isRealUser) {
        return NextResponse.json(
          { error: "Аккаунт с этим номером уже существует", hint: "login" },
          { status: 409 }
        );
      }
    }

    // Upsert stub user for REGISTER (or use existing stub)
    let user = existingUser;
    if (!user) {
      const stubEmail = `phone_${phoneDigits}@pending.mamago.by`;
      user = await prisma.user.upsert({
        where: { email: stubEmail },
        create: { email: stubEmail, passwordHash: "", phoneE164 },
        update: { phoneE164 },
      });
    }

    // Check cooldown — scoped per purpose
    const existing = await prisma.phoneOtp.findUnique({
      where: {
        userId_phoneE164_purpose: { userId: user.id, phoneE164, purpose },
      },
    });

    if (existing && existing.expiresAt > now) {
      const elapsed = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
      const remaining = RESEND_COOLDOWN_SEC - elapsed;
      if (remaining > 0) {
        return NextResponse.json(
          { error: `Повторная отправка через ${Math.ceil(remaining)} сек.` },
          { status: 429 }
        );
      }
    }

    const code = genCode4();
    const codeHash = hashCode(code);

    await prisma.phoneOtp.upsert({
      where: {
        userId_phoneE164_purpose: { userId: user.id, phoneE164, purpose },
      },
      create: { userId: user.id, phoneE164, purpose, codeHash, expiresAt, lastSentAt: now, attempts: 0 },
      update: { codeHash, expiresAt, lastSentAt: now, attempts: 0 },
    });

    if (process.env.NODE_ENV === "development" && process.env.FORCE_SMS !== "true") {
      console.info(`[OTP dev] purpose=${purpose} code=${code}`);
    } else {
      const smsResult = await sendQuickSms({ phoneDigits, message: `Ваш код: ${code}` });
      if (process.env.NODE_ENV !== "production") {
        console.info("[OTP sms] sent", {
          sms_id: smsResult.sms_id,
          status: smsResult.status,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/phone/send-otp]", error);
    return NextResponse.json({ error: "Ошибка отправки кода" }, { status: 500 });
  }
}
