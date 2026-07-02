import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DirectComplaintStatus } from "@prisma/client";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { resolveComplaint } from "@/server/services/direct/directComplaint.service";

const bodySchema = z.object({
  status: z.enum([
    DirectComplaintStatus.REVIEWED,
    DirectComplaintStatus.DISMISSED,
    DirectComplaintStatus.ACTION_TAKEN,
  ]),
  resolution: z.string().trim().min(1).max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ complaintId: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { complaintId } = await params;

  try {
    const json = await request.json();
    const { status, resolution } = bodySchema.parse(json);

    const updated = await resolveComplaint({
      complaintId,
      reviewedByUserId: auth.id,
      actorRole: auth.role,
      status,
      resolution,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[admin/direct] resolve complaint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
