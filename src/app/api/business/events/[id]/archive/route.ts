import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import { archiveActivityById } from "@/lib/activity/archiveActivity";
import { restoreActivityToDraftById } from "@/lib/activity/restoreActivity";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";
import prisma from "@/lib/prisma";

function revalidateBusinessEventLists() {
  revalidatePath("/business/events");
  revalidatePath("/business/publications/events");
}

async function requireEventManager(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  if (!(await canManageActivityById(user, id))) {
    return { user: null, response: NextResponse.json({ error: "Event not found" }, { status: 404 }) };
  }
  return { user, response: null };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const access = await requireEventManager(id);
    if (!access.user) return access.response!;

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await assertContentLifecycleOperationAllowed({
      contentType: "EVENT",
      contentId: id,
      operation: "archiveContent",
      status: summary.status,
      prisma,
    });

    await archiveActivityById(id);
    revalidateBusinessEventLists();
    return NextResponse.json({ success: true, event: { id, status: "ARCHIVED" } });
  } catch (error: unknown) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(lifecycleErrorResponsePayload(error), { status: error.statusCode });
    }
    console.error("Archive event error:", error);
    return NextResponse.json({ error: "Failed to archive event" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const access = await requireEventManager(id);
    if (!access.user) return access.response!;

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status !== "ARCHIVED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await assertContentLifecycleOperationAllowed({
      contentType: "EVENT",
      contentId: id,
      operation: "restoreArchived",
      status: summary.status,
      prisma,
    });

    await restoreActivityToDraftById(id);
    revalidateBusinessEventLists();
    return NextResponse.json({ success: true, event: { id, status: "DRAFT" } });
  } catch (error: unknown) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(lifecycleErrorResponsePayload(error), { status: error.statusCode });
    }
    console.error("Unarchive event error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
