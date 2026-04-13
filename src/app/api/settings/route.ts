import { NextResponse } from "next/server";
import { resolveSettingsContext } from "@/lib/settings/resolveSettingsContext";

export async function GET() {
  const context = await resolveSettingsContext({ requestedScope: "USER" });
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: context.viewer.id,
      email: context.viewer.email,
      displayName: context.viewer.displayName,
      avatarUrl: context.viewer.avatarUrl,
      phoneE164: context.viewer.phoneE164,
      emailVerifiedAt: context.viewer.emailVerifiedAt,
      role: context.viewer.role,
    },
    business: context.businessContext
      ? {
          id: context.businessContext.id,
          name: context.businessContext.name,
          legalName: context.businessContext.legalName,
          unp: context.businessContext.unp,
          verificationStatus: context.businessContext.verificationStatus,
        }
      : null,
    settings: {
      surfaceScope: context.surfaceScope,
      requestedScope: context.requestedScope,
      permissions: context.permissions,
    },
  });
}
