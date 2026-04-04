import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import { restoreActivityToDraftById } from "@/lib/activity/restoreActivity";

/**
 * POST /api/business/events/[id]/restore
 * Restore soft deleted event (status -> DRAFT).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || !canManageOwnedContent(user, summary.ownerUserId)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await restoreActivityToDraftById(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Restore event error:", e);
    return NextResponse.json({ error: "Failed to restore event" }, { status: 500 });
  }
}

