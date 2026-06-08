import { NextResponse } from "next/server";
import { setCurrentRelease } from "@/server/services/release.service";
import { requireReleaseAdmin } from "../../_auth";
import { releaseErrorResponse } from "../../_errors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireReleaseAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const release = await setCurrentRelease(id);
    return NextResponse.json({ success: true, release });
  } catch (error) {
    return releaseErrorResponse(error);
  }
}
