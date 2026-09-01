import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import { restoreActivityToDraftById } from "@/lib/activity/restoreActivity";

/** POST /api/business/events/[id]/restore */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || !(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await restoreActivityToDraftById(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Restore event error:", error);
    return NextResponse.json({ error: "Failed to restore event" }, { status: 500 });
  }
}
