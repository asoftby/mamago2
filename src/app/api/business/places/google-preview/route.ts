import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { getPlaceDetails } from "@/lib/google-places/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canCreateBusinessContent(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
