import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import {
  PlanVisibilityError,
  makePlanItemPrivate,
  sharePlanItemWithFamily,
} from "@/server/family/planVisibility.service";

const bodySchema = z
  .object({
    visibility: z.enum(["PRIVATE", "FAMILY"]),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .strict();

const STATUS: Record<string, number> = {
  disabled: 404,
  not_found: 404,
  not_author: 403,
  wrong_state: 409,
  other_adult_acted: 409,
  conflict: 409,
};

/** Share a private plan item with the family, or make a family item private again. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { id } = await ctx.params;

  const input = {
    userId: user.id,
    planItemId: id,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt ? new Date(parsed.data.expectedUpdatedAt) : null,
    sessionId: await getSessionRowIdFromCookies(),
  };
  try {
    const item =
      parsed.data.visibility === "FAMILY"
        ? await sharePlanItemWithFamily(input)
        : await makePlanItemPrivate(input);
    return NextResponse.json({
      item: { id: item.id, visibility: item.visibility, status: item.status, updatedAt: item.updatedAt.toISOString() },
    });
  } catch (error) {
    if (error instanceof PlanVisibilityError) {
      return NextResponse.json({ error: error.code }, { status: STATUS[error.code] ?? 409 });
    }
    console.error("[plan-visibility] failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
