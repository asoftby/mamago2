import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import { softDeleteActivityById } from "@/lib/activity/softDeleteActivity";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";

/**
 * DELETE /api/admin/moderation/events/[id]
 * Мягкое удаление события из раздела модерации (без проверки владельца).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await softDeleteActivityById(id);

    revalidatePath("/admin/moderation/events");
    revalidatePath("/admin");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[admin] Delete moderation event error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
