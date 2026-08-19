import { NextRequest, NextResponse } from "next/server";
import { DirectComplaintStatus } from "@prisma/client";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { getAdminComplaints } from "@/server/services/direct/directAdmin.service";

const VALID_STATUSES: DirectComplaintStatus[] = [
  DirectComplaintStatus.PENDING,
  DirectComplaintStatus.REVIEWED,
  DirectComplaintStatus.DISMISSED,
  DirectComplaintStatus.ACTION_TAKEN,
];

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = (VALID_STATUSES as string[]).includes(statusParam ?? "")
    ? (statusParam as DirectComplaintStatus)
    : undefined;

  const complaints = await getAdminComplaints(status);
  return NextResponse.json({ items: complaints });
}
