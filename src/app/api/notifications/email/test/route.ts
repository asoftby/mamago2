import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { emailService } from "@/features/email/server/email-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json({ ok: false, code: "EMAIL_MISSING" }, { status: 400 });
    }

    const debugRedirectTo = process.env.EMAIL_DEBUG_REDIRECT_TO?.trim() || null;
    const actualTo = debugRedirectTo || user.email;

    const result = await emailService.sendNotificationEmail({
      to: user.email,
      subject: "Тестовое письмо mamaGo",
      title: "Тестовое уведомление",
      body: "Почтовый канал уведомлений настроен и готов к отправке.",
      ctaLabel: "Открыть настройки",
      ctaUrl: "/settings/notifications",
    });

    if (result.status === "SENT") {
      return NextResponse.json({
        ok: true,
        status: result.status,
        messageId: result.messageId ?? null,
        intendedTo: user.email,
        actualTo,
        redirected: Boolean(debugRedirectTo),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        code: result.reason ?? "EMAIL_NOT_AVAILABLE",
        status: result.status,
        intendedTo: user.email,
        actualTo,
        redirected: Boolean(debugRedirectTo),
      },
      { status: result.status === "SKIPPED" ? 503 : 500 },
    );
  } catch (error) {
    console.error("[email:test] Unexpected error:", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
