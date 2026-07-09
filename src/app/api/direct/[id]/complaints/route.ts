import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  nextResponseFromDirectAccessError,
  requireDirectThreadAccess,
} from "@/lib/auth/directAccess";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  createComplaint,
  DirectComplaintError,
} from "@/server/services/direct/directComplaint.service";

const COMPLAINT_REASONS = ["SPAM", "ABUSE", "SCAM", "OTHER"] as const;

const createComplaintSchema = z.object({
  reason: z.enum(COMPLAINT_REASONS),
  comment: z.string().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();

  let thread;
  try {
    thread = await requireDirectThreadAccess(user, id);
  } catch (error) {
    return nextResponseFromDirectAccessError(error) ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const currentUser = user!;

  const rateLimit = await checkRateLimit(`direct_complaint:${currentUser.id}`, 5, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const data = createComplaintSchema.parse(body);

    const complaint = await createComplaint({
      threadId: thread.id,
      reporterUserId: currentUser.id,
      reason: data.reason,
      comment: data.comment ?? null,
    });

    return NextResponse.json({ id: complaint.id, status: complaint.status }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if (error instanceof DirectComplaintError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[direct] create complaint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
