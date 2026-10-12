import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import {
  OfferRevisionError,
  approveOfferRevision,
  rejectOfferRevision,
} from "@/server/offers/offerRevision.service";

export const runtime = "nodejs";

/**
 * POST /api/admin/moderation/offer-revisions/[id]
 * Body: { action: "APPROVE" | "REJECT", comment?: string } — комментарий обязателен для REJECT.
 * Решение по ожидающей ревизии опубликованного оффера (правки партнёра).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: unknown; comment?: unknown } | null;
  const action = body?.action;
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "Invalid action. Must be APPROVE or REJECT" }, { status: 400 });
  }
  if (action === "REJECT" && !comment) {
    return NextResponse.json({ error: "Comment is required for REJECT" }, { status: 400 });
  }

  try {
    const result =
      action === "APPROVE"
        ? await approveOfferRevision(id, auth.id)
        : await rejectOfferRevision(id, auth.id, comment);
    return NextResponse.json({ success: true, action, offerId: result.offerId });
  } catch (error) {
    if (error instanceof OfferRevisionError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("[admin/offer-revisions] decision failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
