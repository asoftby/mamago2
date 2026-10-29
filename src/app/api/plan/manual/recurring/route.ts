import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolvePlanOwner } from "@/server/services/planOwner";
import { createRecurringTaskSeries, type NewRecurringTask } from "@/server/services/recurringTask.service";

/**
 * Explicit recurrence endpoint. Ordinary manual tasks continue through
 * /api/plan/manual and never accidentally become a recurrence.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    const owner = await resolvePlanOwner(user.id);
    const seriesId = await createRecurringTaskSeries(owner, body as NewRecurringTask);
    return NextResponse.json({ seriesId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "idempotency_conflict") {
      return NextResponse.json({ error: "idempotency_conflict" }, { status: 409 });
    }
    if (error instanceof Error && [
      "invalid_request_key", "invalid_title", "invalid_start_time", "invalid_reminder",
      "invalid_recurrence", "invalid_frequency", "invalid_start_date",
      "invalid_interval", "invalid_until_date", "invalid_count",
      "invalid_weekdays", "unexpected_weekdays", "recurrence_start_not_in_series",
      "invalid_date", "invalid_window", "invalid_child", "invalid_assignee",
      "assignee_and_child", "child_not_found", "assignee_not_found",
    ].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[family-calendar] recurring series create failed", { userId: user.id });
    return NextResponse.json({ error: "recurring_create_failed" }, { status: 500 });
  }
}
