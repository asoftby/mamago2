import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { completeThread } from "@/server/services/direct/directThread.service";

// Only the transition that maps to a real, existing DirectThreadStatus value
// (CLOSED) is exposed here — Phase 3 explicitly reuses the existing enum
// rather than introducing NEW/IN_PROGRESS/CANCELLED as stored states; those
// are view-level buckets computed in directConversation.service.ts. Route
// path kept under /api/business/direct/ for continuity — still called from
// the unified /me/direct/{threadId} screen when viewerRole === "BUSINESS".
const bodySchema = z.object({
  action: z.literal("complete"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const business = await getMyBusiness(user.id);
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const thread = await prisma.directThread.findUnique({
    where: { id },
    select: { id: true, businessId: true, status: true },
  });
  if (!thread || thread.businessId !== business.id) {
    return NextResponse.json({ error: "Not found" }, { status: 403 });
  }
  if (thread.status === "BLOCKED" || thread.status === "ARCHIVED") {
    return NextResponse.json({ error: "Thread cannot be updated in its current state" }, { status: 400 });
  }

  try {
    const body = await request.json();
    bodySchema.parse(body);

    const updated = await completeThread({
      threadId: thread.id,
      completedByUserId: user.id,
      actorRole: user.role,
    });

    return NextResponse.json({ status: updated.status, completedAt: updated.completedAt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[business/direct] status update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
