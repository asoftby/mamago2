import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolvePlanOwner } from "@/server/services/planOwner";
import { cancelRecurringTaskSeries, RecurrenceMutationError } from "@/server/services/recurringTask.service";
import { editRecurringTaskFollowing, getRecurringTaskSeriesForEdit, type FollowingSeriesEdit } from "@/server/services/recurringTaskSeriesEdit.service";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (input.scope !== "FUTURE" && input.scope !== "ALL") {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }
  if (typeof input.expectedUpdatedAt !== "string") {
    return NextResponse.json({ error: "invalid_expected_updated_at" }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    await cancelRecurringTaskSeries(await resolvePlanOwner(user.id), id, input.scope, input.expectedUpdatedAt);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RecurrenceMutationError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[family-calendar] recurrence mutation failed", { userId: user.id });
    return NextResponse.json({ error: "recurrence_mutation_failed" }, { status: 500 });
  }
}

function mutationFailure(error: unknown, userId: string) {
  if (error instanceof RecurrenceMutationError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("[family-calendar] recurrence edit failed", { userId });
  return NextResponse.json({ error: "recurrence_mutation_failed" }, { status: 500 });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const series = await getRecurringTaskSeriesForEdit(await resolvePlanOwner(user.id), id);
    return NextResponse.json({ series });
  } catch (error) {
    return mutationFailure(error, user.id);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    const result = await editRecurringTaskFollowing(
      await resolvePlanOwner(user.id), id, body as FollowingSeriesEdit,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return mutationFailure(error, user.id);
  }
}
