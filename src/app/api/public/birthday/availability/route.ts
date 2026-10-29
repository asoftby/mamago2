import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getPublicPartySlotPreview } from "@/server/birthday/partyPublicSlots.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  citySlug: z.string().min(1).max(80),
  offerId: z.string().min(1).max(100),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().int().min(30).max(720),
  guestCount: z.coerce.number().int().min(1).max(1000),
});
export async function GET(request: NextRequest) {
  const limit = await checkRateLimit("party_slots:" + (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"), 30, 60000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const dayDate = new Date(parsed.data.day + "T00:00:00.000Z");
  if (!Number.isFinite(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== parsed.data.day) return NextResponse.json({ error: "Invalid date" }, { status: 422 });
  try {
    const result = await getPublicPartySlotPreview(parsed.data);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ ...result, finalConfirmationRequired: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ mode: "REQUEST_ONLY", slots: [], finalConfirmationRequired: true }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
