import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiUser, requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import {
  getDirectPlatformSettings,
  updateDirectPlatformSettings,
  updateDirectPlatformSettingsSchema,
} from "@/server/services/direct/directPlatformSettings.service";

export async function GET() {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const settings = await getDirectPlatformSettings();
  return NextResponse.json(settings);
}

/**
 * Platform-wide Direct policy is a bigger lever than day-to-day moderation
 * (block/hide/resolve) — write access is ADMIN-only, unlike the other
 * /api/admin/direct/** routes which allow MODERATOR too.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const json = await request.json();
    const patch = updateDirectPlatformSettingsSchema.parse(json);

    const updated = await updateDirectPlatformSettings(patch, { userId: auth.id, role: auth.role });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[admin/direct] settings update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
