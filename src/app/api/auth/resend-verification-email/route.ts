import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resendVerificationEmailForUser } from "@/server/auth/email-verification";
import { completeOnboardingNotification } from "@/server/services/notification.service";

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

    const email = user.email?.trim();
    if (!email) {
      return NextResponse.json(
        {
          code: "NO_EMAIL" as const,
          message: "Укажите email в профиле, чтобы подтвердить почту.",
        },
        { status: 400 },
      );
    }

    if (user.emailVerifiedAt) {
      await completeOnboardingNotification(user.id, "VERIFY_EMAIL");
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        email,
      });
    }

    const result = await resendVerificationEmailForUser(user.id, email);

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
      await completeOnboardingNotification(user.id, "VERIFY_EMAIL");
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        email,
      });
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      alreadyVerified: false,
      email,
    });
  } catch (e) {
    console.error("[auth/resend-verification-email]", e);
    return NextResponse.json(
      { error: "Не удалось отправить письмо" },
      { status: 500 },
    );
  }
}
