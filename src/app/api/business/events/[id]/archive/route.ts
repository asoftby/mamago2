import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import { archiveActivityById } from "@/lib/activity/archiveActivity";
import { restoreActivityToDraftById } from "@/lib/activity/restoreActivity";

function revalidateBusinessEventLists() {
  revalidatePath("/business/events");
  revalidatePath("/business/publications/events");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await archiveActivityById(id);
    revalidateBusinessEventLists();

    return NextResponse.json({ success: true, event: { id, status: "ARCHIVED" } });
  } catch (error: unknown) {
    console.error("Archive event error:", error);
    const message = error instanceof Error ? error.message : "Failed to archive event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await restoreActivityToDraftById(id);
    revalidateBusinessEventLists();

    return NextResponse.json({ success: true, event: { id, status: "DRAFT" } });
  } catch (error: unknown) {
    console.error("Unarchive event error:", error);
    const message = error instanceof Error ? error.message : "Failed to unarchive event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
