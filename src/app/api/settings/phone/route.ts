import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  BUSINESS_CONTACT_VERIFICATION_PURPOSE,
  LEGACY_BUSINESS_PHONE_VERIFY_PURPOSE,
} from "@/lib/phone-verification/businessContactVerification.shared";

export const runtime = "nodejs";

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Требуется авторизация" },
      { status: 401 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        phoneE164: null,
        phoneVerifiedAt: null,
      },
    });

    await tx.phoneOtp.deleteMany({
      where: {
        userId: user.id,
        purpose: {
          in: [
            BUSINESS_CONTACT_VERIFICATION_PURPOSE,
            LEGACY_BUSINESS_PHONE_VERIFY_PURPOSE,
          ],
        },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
