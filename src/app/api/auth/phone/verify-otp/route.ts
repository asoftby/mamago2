import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { hashCode, safeEq } from "@/lib/otp/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

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

    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("[auth/phone/verify-otp]", error);
    const msg = error instanceof Error ? error.message : "Внутренняя ошибка";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
