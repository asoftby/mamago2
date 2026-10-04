import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolvePlanOwner } from "@/server/services/planOwner";
import { ManualPlanEntryError } from "@/server/services/manualPlanEntry.service";
import { loadFamilyCalendarRange } from "@/server/services/familyCalendar.service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const payload = await loadFamilyCalendarRange({ owner: resolvePlanOwner(user.id), from: from ?? "", to: to ?? "" });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ManualPlanEntryError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    console.error("[family-calendar] range read failed", { userId: user.id });
    return NextResponse.json({ error: "calendar_read_failed" }, { status: 500 });
  }
}
