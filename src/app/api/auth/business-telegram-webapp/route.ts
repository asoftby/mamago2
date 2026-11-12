import { NextRequest, NextResponse } from "next/server";
import { prismaBase } from "@/lib/prisma";
import { getPartnerCabinetBusiness } from "@/server/permissions/business-permissions";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/server";
import { verifyTelegramWebAppInitData } from "@/lib/telegram/verifyWebAppInitData";
import { getBusinessTelegramConfig } from "@/server/config/businessTelegram.config";
import { businessTelegramDeliveryEnabled } from "@/server/services/telegram/businessTelegramDelivery.service";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

function reject(reason: "INVALID_ORIGIN" | "TELEGRAM_NOT_LINKED" | "ACCOUNT_UNAVAILABLE" | "BUSINESS_CONTEXT_MISMATCH") {
  // Never log initData, Telegram identifiers, cookies or customer data.
  console.warn("[business-telegram-webapp] Authentication rejected:", reason);
  return NextResponse.json({ error: reason }, { status: 403, headers: noStore });
}

function configuredPublicOrigin(): string | null {
  const value = process.env.NEXTAUTH_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const origin = configuredPublicOrigin();
  if (!origin) return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: noStore });
  if (request.headers.get("origin") !== origin) return reject("INVALID_ORIGIN");
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 415, headers: noStore });
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 12_000) {
    return NextResponse.json({ error: "INVALID_INIT_DATA" }, { status: 413, headers: noStore });
  }
  const body: unknown = await request.json().catch(() => null);
  const initData = body && typeof body === "object" && "initData" in body &&
    typeof body.initData === "string" ? body.initData : null;
  if (!initData || initData.length > 8192) {
    return NextResponse.json({ error: "INVALID_INIT_DATA" }, { status: 401, headers: noStore });
  }

  const bot = getBusinessTelegramConfig();
  if (!bot.configured || !businessTelegramDeliveryEnabled()) {
    return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: noStore });
  }
  // Crucially, do not verify Business Bot initData with the Family/Info Bot token.
  const verified = verifyTelegramWebAppInitData(initData, bot.botToken);
  if (!verified) {
    return NextResponse.json({ error: "INVALID_INIT_DATA" }, { status: 401, headers: noStore });
  }
  const connection = await prismaBase.businessTelegramConnection.findFirst({
    where: {
      environment: bot.environment,
      telegramChatId: verified.telegramUserId,
      telegramUserId: verified.telegramUserId,
      botUsername: bot.botUsername,
      isActive: true,
    },
    select: { userId: true, businessId: true },
  });
  if (!connection) return reject("TELEGRAM_NOT_LINKED");

  // The protected cabinet uses this same canonical active membership.
  // A valid connection to another represented business must not authenticate
  // into the wrong inbox. Business switching is not implemented by this route.
  const business = await getPartnerCabinetBusiness(connection.userId);
  if (!business || business.operationalStatus !== "ACTIVE") return reject("TELEGRAM_NOT_LINKED");
  if (business.id !== connection.businessId) return reject("BUSINESS_CONTEXT_MISMATCH");

  try {
    const current = await getCurrentUser();
    if (current?.id === connection.userId) {
      return NextResponse.json({ ok: true }, { headers: noStore });
    }
    const token = await createSession(connection.userId);
    const response = NextResponse.json({ ok: true }, { headers: noStore });
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    setSessionCookie(response, token, host ?? undefined);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_SESSION_ELIGIBLE") {
      return reject("ACCOUNT_UNAVAILABLE");
    }
    console.error("[business-telegram-webapp] Session creation failed");
    return NextResponse.json({ error: "AUTH_FAILED" }, { status: 500, headers: noStore });
  }
}
