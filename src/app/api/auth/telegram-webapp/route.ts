import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/server";
import { verifyTelegramWebAppInitData } from "@/lib/telegram/verifyWebAppInitData";
import { getTelegramConfig } from "@/server/config/telegram.config";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403, headers: noStore });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 415, headers: noStore });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 12_000) {
    return NextResponse.json({ error: "INVALID_INIT_DATA" }, { status: 413, headers: noStore });
  }
  const body = await request.json().catch(() => null);
  const initData = body && typeof body === "object" && typeof body.initData === "string"
    ? body.initData : null;
  if (!initData || initData.length > 8192) {
    return NextResponse.json({ error: "INVALID_INIT_DATA" }, { status: 401, headers: noStore });
  }

  const config = getTelegramConfig();
  if (!config.botToken || !config.botUsername) {
    return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: noStore });
  }

  const verified = verifyTelegramWebAppInitData(initData, config.botToken);
  if (!verified) {
    return NextResponse.json({ error: "INVALID_INIT_DATA" }, { status: 401, headers: noStore });
  }

  // Only private-chat connections for the CURRENT bot and environment may log in.
  // A forwarded button cannot authenticate the person who forwarded it.
  const connection = await prisma.telegramConnection.findUnique({
    where: {
      environment_telegramChatId: {
        environment: config.environment,
        telegramChatId: verified.telegramUserId,
      },
    },
    select: { userId: true, telegramUserId: true, isActive: true, botUsername: true },
  });
  if (
    !connection?.isActive ||
    connection.telegramUserId !== verified.telegramUserId ||
    connection.botUsername.replace(/^@/u, "").toLowerCase() !== config.botUsername.toLowerCase()
  ) {
    return NextResponse.json({ error: "TELEGRAM_NOT_LINKED" }, { status: 403, headers: noStore });
  }

  try {
    // Avoid creating unlimited duplicate sessions when the right account is already active.
    const current = await getCurrentUser();
    if (current?.id === connection.userId) {
      return NextResponse.json({ ok: true }, { headers: noStore });
    }
    // An eligible linked account gets a fresh cookie, replacing any different
    // user session in this browser; the user's other sessions stay intact.
    const token = await createSession(connection.userId);
    const response = NextResponse.json({ ok: true }, { headers: noStore });
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    setSessionCookie(response, token, host ?? undefined);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_SESSION_ELIGIBLE") {
      return NextResponse.json({ error: "ACCOUNT_UNAVAILABLE" }, { status: 403, headers: noStore });
    }
    console.error("[telegram-webapp] Failed to create account session", error);
    return NextResponse.json({ error: "AUTH_FAILED" }, { status: 500, headers: noStore });
  }
}
