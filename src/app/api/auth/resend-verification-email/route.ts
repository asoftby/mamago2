import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resendVerificationEmailForUser } from "@/server/auth/email-verification";

/**
 * POST /api/auth/resend-verification-email
 * Повторная отправка письма подтверждения email (только для текущего пользователя).
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
      });
    }

    const result = await resendVerificationEmailForUser(user.id, user.email);

    if ("rateLimited" in result && result.rateLimited) {
      return NextResponse.json(
        {
          code: "RATE_LIMIT" as const,
          message: "Подождите перед повторной отправкой",
        },
        { status: 429 },
      );
    }

    if ("sent" in result && !result.sent) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
      });
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      alreadyVerified: false,
    });
  } catch (e) {
    console.error("[auth/resend-verification-email]", e);
    return NextResponse.json(
      { error: "Не удалось отправить письмо" },
      { status: 500 },
    );
  }
}
