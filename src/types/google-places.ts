/**
 * Типы для Google Places API (New)
 * https://developers.google.com/maps/documentation/places/web-service/place-details
 */

export interface GooglePlaceReview {
  name: string; // Resource name, e.g., "places/ChIJ.../reviews/..."
  relativePublishTimeDescription: string; // e.g., "2 months ago"
  rating: number; // 1-5
  text: {
    text: string;
    languageCode: string;
  };
  originalText: {
    text: string;
    languageCode: string;
  };
  authorAttribution: {
    displayName: string;
    uri: string;
    photoUri?: string;
  };
  publishTime: string; // ISO 8601 timestamp
}

export interface GooglePlaceDetails {
  id: string; // Place ID
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: GooglePlaceReview[];
  googleMapsUri?: string;
}

export interface GooglePlaceDetailsResponse {
  // Новый API v1 возвращает данные напрямую, без обертки "place"
  id?: string;
  displayName?: {
    text: string;
    languageCode: string;
  };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: GooglePlaceReview[];
  googleMapsUri?: string;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Упрощенный формат для хранения в БД
 */
export interface StoredGoogleReview {
  authorName: string;
  authorPhotoUri?: string;
  rating: number;
  relativeTime?: string;
  text: string;
  originalText?: string;
  textLanguageCode?: string;
  originalTextLanguageCode?: string;
  publishTime: string;
}

export interface StoredGoogleReviews {
  reviews: StoredGoogleReview[];
  syncedAt: string;
}
