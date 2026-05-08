"use client";

import { useState } from "react";
import { Star, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StoredGoogleReview } from "@/types/google-places";

interface PlaceGoogleReviewsProps {
  googleRating?: number | null;
  googleUserRatingsTotal?: number | null;
  googleReviews?: StoredGoogleReview[] | null;
  googleMapsUri?: string | null;
  googlePlaceId?: string | null;
}

export function PlaceGoogleReviews({
  googleRating,
  googleUserRatingsTotal,
  googleReviews,
  googleMapsUri,
  googlePlaceId,
}: PlaceGoogleReviewsProps) {
  // Не показываем блок, если нет Google Place ID
  if (!googlePlaceId) {
    return null;
  }

  const hasReviews = googleReviews && googleReviews.length > 0;
  const hasRating = googleRating && googleUserRatingsTotal;

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return new Intl.DateTimeFormat("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch {
      return "";
    }
  };

  const getGoogleMapsReviewsUrl = () => {
    if (googleMapsUri) {
      return googleMapsUri;
    }
    return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${googlePlaceId}`;
  };

  return (
    <section className="pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Отзывы Google</h2>
          <img
            src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_74x24dp.png"
            alt="Google"
            className="h-5"
          />
        </div>
      </div>

      {/* Rating summary */}
      {hasRating && (
        <div className="mb-6">
          <Card className="border-gray-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-5xl font-bold text-gray-900 mb-2">
                    {googleRating.toFixed(1)}
                  </div>
                  <div className="flex justify-center mb-2">
                    {renderStars(Math.round(googleRating))}
                  </div>
                  <div className="text-sm text-gray-600">
                    {googleUserRatingsTotal.toLocaleString("ru-RU")} оценок
                  </div>
                </div>
                <div className="flex-1 text-sm text-gray-600">
                  <p>
                    Рейтинг и отзывы предоставлены Google Maps. Они помогают
                    другим пользователям узнать больше о качестве обслуживания
                    и атмосфере места.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reviews list */}
      {hasReviews ? (
        <div className="space-y-4 mb-6">
          {googleReviews.slice(0, 5).map((review, index) => (
            <ReviewCard key={index} review={review} formatDate={formatDate} renderStars={renderStars} />
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <Card className="border-gray-200">
            <CardContent className="p-6 text-center text-gray-600">
              <p>Пока нет доступных отзывов Google для этого места.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Link to Google Maps */}
      <div className="text-center">
        <Button asChild variant="outline" size="lg" className="gap-2">
          <a
            href={getGoogleMapsReviewsUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-4 h-4" />
            Смотреть все отзывы в Google Maps
          </a>
        </Button>
      </div>
    </section>
  );
}

interface ReviewCardProps {
  review: StoredGoogleReview;
  formatDate: (isoDate: string) => string;
  renderStars: (rating: number) => React.ReactElement;
}

function ReviewCard({ review, formatDate, renderStars }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 200;
  const needsTruncation = review.text.length > maxLength;
  const displayText = isExpanded || !needsTruncation
    ? review.text
    : review.text.slice(0, maxLength) + "...";

  return (
    <Card className="border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {review.authorPhotoUri ? (
              <img
                src={review.authorPhotoUri}
                alt={review.authorName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                {review.authorName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Review content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold text-gray-900">
                  {review.authorName}
                </div>
                <div className="text-sm text-gray-500">
                  {review.relativeTime}
                  {review.publishTime && (
                    <span className="ml-2">
                      • {formatDate(review.publishTime)}
                    </span>
                  )}
                </div>
              </div>
              {renderStars(review.rating)}
            </div>

            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {displayText}
            </p>

            {needsTruncation && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                {isExpanded ? "Свернуть" : "Читать полностью"}
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
