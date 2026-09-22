import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PHONE_OTP_PUBLIC_RESPONSE } from "@/server/auth/phoneOtpSend.service";
import { POST } from "./route";

function request(phone: string, purpose: "LOGIN" | "REGISTER", ip: string) {
  return new NextRequest("http://localhost/api/auth/phone/send-otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": ip,
    },
    body: JSON.stringify({ phone, purpose }),
  });
}

async function main() {
  const marker = randomUUID().replace(/-/g, "").slice(0, 8);
  const existingLoginPhone = "+375291234511";
  const existingRegisterPhone = "+375331234512";
  const missingLoginPhone = "+375441234501";
  const missingRegisterPhone = "+375291234514";

  process.env.TRUST_PROXY_HEADERS = "true";
  const createdUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: `otp-enum-login-${marker}@example.invalid`,
        passwordHash: "hash",
        phoneE164: existingLoginPhone,
      },
    }),
    prisma.user.create({
      data: {
        email: `otp-enum-register-${marker}@example.invalid`,
        passwordHash: "hash",
        phoneE164: existingRegisterPhone,
      },
    }),
  ]);

  try {
    const responses = await Promise.all([
      POST(request(existingLoginPhone, "LOGIN", "203.0.113.11")),
      POST(request(missingLoginPhone, "LOGIN", "203.0.113.12")),
      POST(request(existingRegisterPhone, "REGISTER", "203.0.113.13")),
      POST(request(missingRegisterPhone, "REGISTER", "203.0.113.14")),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200]);
    for (const body of bodies) {
      assert.deepEqual(body, PHONE_OTP_PUBLIC_RESPONSE);
    }
    console.log("phone OTP endpoint enumeration integration test: OK");
  } finally {
    await prisma.phoneOtp.deleteMany({
      where: { userId: { in: createdUsers.map((user) => user.id) } },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: createdUsers.map((user) => user.id) } },
          { email: { contains: marker } },
        ],
      },
    });
    await prisma.rateLimitEntry.deleteMany({
      where: { key: { startsWith: "otp:sms:" } },
    });
    await prisma.$disconnect();
  }
}

void main();
