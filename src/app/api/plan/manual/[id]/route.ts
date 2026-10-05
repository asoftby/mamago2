import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolvePlanOwner } from "@/server/services/planOwner";
import {
  cancelManualPlanEntry,
  ManualPlanEntryError,
  updateManualPlanEntry,
  type ManualPlanEntryPatch,
} from "@/server/services/manualPlanEntry.service";
import { loadFamilyCalendarItem } from "@/server/services/familyCalendar.service";

function errorResponse(error: unknown, userId: string) {
  if (error instanceof ManualPlanEntryError) {
    return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
  }
  console.error("[family-calendar] manual mutation failed", { userId });
  return NextResponse.json({ error: "manual_mutation_failed" }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = await request.json() as ManualPlanEntryPatch;
    const owner = await resolvePlanOwner(user.id);
    const item = await updateManualPlanEntry(owner, id, body);
    return NextResponse.json({ item: await loadFamilyCalendarItem({ owner, item }) });
  } catch (error) {
    return errorResponse(error, user.id);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    await cancelManualPlanEntry(await resolvePlanOwner(user.id), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, user.id);
  }
}
