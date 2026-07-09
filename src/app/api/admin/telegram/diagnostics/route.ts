import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getTelegramDiagnostics } from "@/server/services/telegram/telegramDiagnostics.service";

export const runtime = "nodejs";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const limit = await checkRateLimit(`admin-tg-diagnostics:${auth.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Слишком часто. Подожди минуту и повтори." },
      { status: 429 },
    );
  }

  try {
    const diagnostics = await getTelegramDiagnostics();
    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error("[admin:telegram:diagnostics] failed", error);
    return NextResponse.json({ error: "Diagnostics failed" }, { status: 500 });
  }
}
