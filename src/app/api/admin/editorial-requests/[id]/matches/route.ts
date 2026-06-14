import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { previewEditorialRequestMatchesByRequestId } from "@/server/editorial/editorialRequestMatchingService";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const matches = await previewEditorialRequestMatchesByRequestId(id);

  if (!matches) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(matches);
}
