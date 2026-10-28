import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { previewPartyOfferAvailability } from "@/server/birthday/partyAvailabilityPreview.service";

export const runtime = "nodejs";
const schema = z.object({
  offerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timeTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  childrenCount: z.coerce.number().int().min(0).max(500),
  adultsCount: z.coerce.number().int().min(0).max(500),
});
export async function GET(request: NextRequest) {
  const limit = await checkRateLimit("party_preview:" + (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"), 30, 60000);
  if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Некорректные параметры" }, { status: 422 });
  const input = parsed.data;
  const date = new Date(input.date + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date ||
      input.timeFrom >= input.timeTo || input.childrenCount + input.adultsCount < 1)
    return NextResponse.json({ error: "Некорректная дата или интервал" }, { status: 422 });
  try {
    const result = await previewPartyOfferAvailability(input);
    return NextResponse.json({ ...result, finalConfirmationRequired: true },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ availability: "UNKNOWN", finalConfirmationRequired: true },
      { headers: { "Cache-Control": "private, no-store" } });
  }
}
