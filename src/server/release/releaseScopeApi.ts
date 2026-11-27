import { NextResponse } from "next/server";
import { isPublicReleaseFeatureEnabled, type PublicReleaseFeature } from "@/lib/release/publicReleaseScope";

/** Real 404 for public API endpoints of a feature outside the release scope (AUDIT-XR-19). */
export function releaseScopeApiGuard(feature: PublicReleaseFeature): NextResponse | null {
  if (isPublicReleaseFeatureEnabled(feature)) return null;
  return NextResponse.json(
    { error: "NOT_FOUND" },
    { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
