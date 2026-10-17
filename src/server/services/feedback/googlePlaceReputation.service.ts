import type { GooglePlaceReputation } from "@/lib/feedback/placeReputation";

/**
 * Request-time-only Google Maps rating. Places API content is NOT persisted
 * or combined into mamaGo's quality score. Use only when the place match was
 * confirmed, and only under an explicit rollout flag due to API billing.
 */
export async function loadLiveGooglePlaceReputation(
  googlePlaceId: string,
): Promise<GooglePlaceReputation | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !googlePlaceId.trim()) return null;
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      },
    );
    if (!response.ok) return null;
    const result = await response.json() as {
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
    };
    if (!Number.isFinite(result.rating) || !Number.isInteger(result.userRatingCount)
      || (result.rating ?? 0) < 1 || (result.rating ?? 6) > 5
      || (result.userRatingCount ?? 0) <= 0) return null;

    const url = result.googleMapsUri?.startsWith("https://www.google.com/maps")
      ? result.googleMapsUri : undefined;
    return { rating: result.rating!, count: result.userRatingCount!, mapsUrl: url };
  } catch {
    // Never log credentials or raw Places API responses.
    return null;
  }
}
