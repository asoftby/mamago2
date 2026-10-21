import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { businessTelegramStatus, createBusinessTelegramLink, disconnectBusinessTelegram } from "@/server/services/telegram/businessTelegram.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await businessTelegramStatus(user.id);
  return result ? NextResponse.json(result) : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await createBusinessTelegramLink(user.id)); }
  catch { return NextResponse.json({ error: "Business Telegram unavailable or access denied" }, { status: 403 }); }
}
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return (await disconnectBusinessTelegram(user.id))
    ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
