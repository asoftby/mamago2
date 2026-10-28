import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicPartySlotPreview } from "@/server/birthday/partyPublicSlots.service";

export const runtime = "nodejs";

const querySchema = z.object({
  city: z.string().regex(/^[a-z][a-z0-9-]{0,80}$/),
  offerId: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().int().min(30).max(720),
  guestCount: z.coerce.number().int().min(1).max(1000),
});

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse(Object.fromEntries(params.entries()));
  if (!parsed.success)
    return NextResponse.json({ error: "Некорректные параметры времени" }, { status: 422 });
  const { city, offerId, date, durationMinutes, guestCount } = parsed.data;
  const day = new Date(date + "T00:00:00.000Z");
  const horizon = Date.now() + 366 * 24 * 60 * 60_000;
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date ||
      day.getTime() > horizon || day.getTime() < Date.now() - 2 * 24 * 60 * 60_000)
    return NextResponse.json({ error: "Недопустимая дата праздника" }, { status: 422 });
  try {
    const preview = await getPublicPartySlotPreview({
      citySlug: city, offerId, day: date, durationMinutes, guestCount,
    });
    if (!preview) return NextResponse.json({ error: "Предложение не найдено" }, { status: 404 });
    return NextResponse.json(preview, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[birthday/availability] failed", error);
    return NextResponse.json({ error: "Не удалось проверить доступность" }, { status: 500 });
  }
}
