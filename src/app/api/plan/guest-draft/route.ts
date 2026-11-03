import { NextRequest, NextResponse } from "next/server";
import { confirmedGuestPlanOccurrences } from "@/server/services/guestPlanAvailabilityQuery";
import { guestDraftRefreshSchema } from "@/lib/decision/planRequestSchemas";

/** Revalidate existing guest draft occurrences without spending another generation. */
export async function POST(request: NextRequest) {
  try {
    const parsed = guestDraftRefreshSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_draft" }, { status: 400 });
    const occurrences = await confirmedGuestPlanOccurrences(parsed.data.ids, parsed.data.date, parsed.data.dateTo);
    return NextResponse.json(
      { occurrences: Object.fromEntries(occurrences) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "draft_unavailable" }, { status: 503 });
  }
}
