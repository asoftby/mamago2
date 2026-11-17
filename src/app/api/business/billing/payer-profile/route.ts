import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBusinessPayer, saveBusinessPayer } from "@/server/business/payerProfile";
import { ZodError } from "zod";
const privateHeaders = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Проверьте реквизиты", details: error.flatten() }, { status: 400 });
  if (error instanceof Error && error.message === "OWNER_REQUIRED") return NextResponse.json({ error: "Business owner access required" }, { status: 403 });
  console.error("[payer-profile] Failed", error);
  return NextResponse.json({ error: "Не удалось сохранить реквизиты" }, { status: 500 });
}
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await getBusinessPayer(user.id), { headers: privateHeaders }); } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try { await saveBusinessPayer(user.id, payload); return NextResponse.json({ ok: true }, { headers: privateHeaders }); } catch (error) { return failure(error); }
}
