import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";

import { getPlaceDetails } from "@/lib/google-places/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

  const googlePlaceId = request.nextUrl.searchParams.get("googlePlaceId");
  if (!googlePlaceId) {
    return NextResponse.json({ error: "googlePlaceId is required" }, { status: 400 });
  }

  const details = await getPlaceDetails(googlePlaceId);
  if (!details) {
    return NextResponse.json({ error: "Google place not found" }, { status: 404 });
  }

  return NextResponse.json({
    googlePlaceId,
    displayName: details.displayName?.text || "",
    formattedAddress: details.formattedAddress || "",
    rating: details.rating ?? null,
    userRatingCount: details.userRatingCount ?? null,
    googleMapsUri: details.googleMapsUri ?? null,
  });
}
