import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolvePlanOwner } from "@/server/services/planOwner";
import {
  createManualPlanEntry,
  ManualPlanEntryError,
  type ManualPlanEntryInput,
} from "@/server/services/manualPlanEntry.service";
import { loadFamilyCalendarItem } from "@/server/services/familyCalendar.service";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Partial<ManualPlanEntryInput>;
    const owner = await resolvePlanOwner(user.id);
    const item = await createManualPlanEntry(owner, {
      entryType: body.entryType!,
      title: body.title!,
      date: body.date!,
      childId: body.childId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      dueAt: body.dueAt,
      dueHasTime: body.dueHasTime,
      locationText: body.locationText,
      notes: body.notes,
    });
    return NextResponse.json({ item: await loadFamilyCalendarItem({ owner, item }) }, { status: 201 });
  } catch (error) {
    if (error instanceof ManualPlanEntryError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    console.error("[family-calendar] manual create failed", { userId: user.id });
    return NextResponse.json({ error: "manual_create_failed" }, { status: 500 });
  }
}
