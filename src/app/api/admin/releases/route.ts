import { NextRequest, NextResponse } from "next/server";
import {
  createRelease,
  listReleases,
} from "@/server/services/release.service";
import { createReleaseInputSchema } from "@/server/services/release.schema";
import { requireReleaseAdmin } from "./_auth";
import { releaseErrorResponse } from "./_errors";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireReleaseAdmin();
  if (auth.response) return auth.response;

  try {
    const releases = await listReleases();
    return NextResponse.json({ success: true, releases });
  } catch (error) {
    return releaseErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireReleaseAdmin();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input = createReleaseInputSchema.parse(body);
    const release = await createRelease(input);
    return NextResponse.json({ success: true, release }, { status: 201 });
  } catch (error) {
    return releaseErrorResponse(error);
  }
}
