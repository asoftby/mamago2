import { NextRequest, NextResponse } from "next/server";
import {
  deleteRelease,
  getReleaseById,
  updateRelease,
} from "@/server/services/release.service";
import { updateReleaseInputSchema } from "@/server/services/release.schema";
import { requireReleaseAdmin } from "../_auth";
import { releaseErrorResponse } from "../_errors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireReleaseAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const release = await getReleaseById(id);
    return NextResponse.json({ success: true, release });
  } catch (error) {
    return releaseErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireReleaseAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = updateReleaseInputSchema.parse(body);
    const release = await updateRelease(id, input);
    return NextResponse.json({ success: true, release });
  } catch (error) {
    return releaseErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireReleaseAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    await deleteRelease(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return releaseErrorResponse(error);
  }
}
