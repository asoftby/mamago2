import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { recordNpdCheck } from "@/server/business/npdCheck";
import { z } from "zod";
const schema = z.object({ result: z.enum(["CONFIRMED", "NOT_FOUND", "UNAVAILABLE"]) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid result" }, { status: 400 });
  const { id } = await params;
  try {
    await recordNpdCheck(actor, id, parsed.data.result);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Заявка изменилась или не ожидает проверки НПД" }, { status: 409 }); }
}
