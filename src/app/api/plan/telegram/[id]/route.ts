import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolvePlanOwner } from "@/server/services/planOwner";
import {
  ManualPlanEntryError,
  updateTelegramPlanEntry,
  type ManualPlanEntryPatch,
} from "@/server/services/manualPlanEntry.service";
import { loadFamilyCalendarItem } from "@/server/services/familyCalendar.service";

/**
 * Edit the PlanItem created by Telegram, keeping source, inbox link and original
 * message untouched. Never accept client-supplied source, owner or metadata.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await request.json() as ManualPlanEntryPatch & { expectedUpdatedAt?: string };
    const owner = await resolvePlanOwner(user.id);
    const item = await updateTelegramPlanEntry(owner, id, {
      title: body.title,
      date: body.date,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      childId: body.childId,
      assigneeUserId: body.assigneeUserId,
      reminderEnabled: body.reminderEnabled,
      reminderLeadMinutes: body.reminderLeadMinutes,
      locationText: body.locationText,
      notes: body.notes,
      tags: body.tags,
    }, body.expectedUpdatedAt!);
    return NextResponse.json({ item: await loadFamilyCalendarItem({ owner, item }) });
  } catch (error) {
    if (error instanceof ManualPlanEntryError) {
      return NextResponse.json({ error: error.message }, {
        status: error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400,
      });
    }
    console.error("[family-calendar] Telegram plan edit failed", { userId: user.id });
    return NextResponse.json({ error: "telegram_plan_update_failed" }, { status: 500 });
  }
}
