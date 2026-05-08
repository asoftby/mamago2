/**
 * Google Places API Client (New API)
 * https://developers.google.com/maps/documentation/places/web-service/place-details
 */

import type {
  GooglePlaceDetailsResponse,
  GooglePlaceDetails,
  StoredGoogleReview,
} from "@/types/google-places";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_API_URL = "https://places.googleapis.com/v1/places";

if (!GOOGLE_PLACES_API_KEY) {
  console.warn(
    "⚠️  GOOGLE_PLACES_API_KEY not set. Google Places features will be disabled."
  );
}

/**
 * Получить детали места из Google Places API
 */
export async function getPlaceDetails(
  placeId: string
): Promise<GooglePlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.error("Google Places API key not configured");
    return null;
  }

  try {
    // New API v1 format: places/{place_id}
    const url = `${GOOGLE_PLACES_API_URL}/${placeId}`;
    
    console.log("[Google Places] Fetching place details:", {
      placeId,
      url,
      hasApiKey: !!GOOGLE_PLACES_API_KEY,
    });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        // Правильный FieldMask для API v1
        "X-Goog-FieldMask":
          "id,displayName,rating,userRatingCount,reviews,googleMapsUri",
      },
    });

    console.log("[Google Places] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Places API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return null;
    }

    const data: GooglePlaceDetailsResponse = await response.json();
    
    console.log("[Google Places] Full response data:", JSON.stringify(data, null, 2));
    
    console.log("[Google Places] Response data:", {
      hasId: !!data.id,
      hasError: !!data.error,
      rating: data.rating,
      reviewsCount: data.reviews?.length,
    });

    if (data.error) {
      console.error("Google Places API returned error:", data.error);
      return null;
    }

    // Новый API v1 возвращает данные напрямую
    if (!data.id) {
      console.error("Google Places API returned no data");
      return null;
    }

    // Преобразуем в формат GooglePlaceDetails
    return {
      id: data.id,
      displayName: data.displayName || { text: "", languageCode: "en" },
      rating: data.rating,
      userRatingCount: data.userRatingCount,
      reviews: data.reviews,
      googleMapsUri: data.googleMapsUri,
    };
  } catch (error) {
    console.error("Failed to fetch Google Place details:", error);
    return null;
  }
}

/**
 * Конвертировать Google отзывы в формат для хранения в БД
 */
export function convertGoogleReviewsToStored(
  placeDetails: GooglePlaceDetails
): StoredGoogleReview[] {
  if (!placeDetails.reviews || placeDetails.reviews.length === 0) {
    return [];
  }

  return placeDetails.reviews.map((review) => ({
    authorName: review.authorAttribution.displayName,
    authorPhotoUri: review.authorAttribution.photoUri,
    rating: review.rating,
    relativeTime: review.relativePublishTimeDescription,
    text: review.text.text,
    publishTime: review.publishTime,
  }));
}

/**
 * Поиск Google Place ID по названию и адресу
 * Используется для мест, созданных вручную
 */
export async function findPlaceByTextSearch(
  query: string
): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.error("Google Places API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `${GOOGLE_PLACES_API_URL}:searchText`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName",
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 1,
        }),
      }
    );

    if (!response.ok) {
      console.error("Google Places Text Search error:", response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.places && data.places.length > 0) {
      return data.places[0].id;
    }

    return null;
  } catch (error) {
    console.error("Failed to search Google Place:", error);
    return null;
  }
}
