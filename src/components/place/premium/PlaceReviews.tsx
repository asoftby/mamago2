"use client";

import { Star, ThumbsUp } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

interface Review {
  id: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  date: string;
  text: string;
  helpful?: number;
}

interface PlaceReviewsProps {
  reviews: Review[];
  averageRating?: number;
  totalReviews?: number;
  ratingBreakdown?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export function PlaceReviews({
  reviews,
  averageRating = 5.0,
  totalReviews = 0,
  ratingBreakdown,
}: PlaceReviewsProps) {
  const [showAll, setShowAll] = useState(false);
  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);

  if (!reviews || reviews.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "long",
    }).format(date);
  };

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

  return (
    <section className="pt-8 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Отзывы гостей
      </h2>

      {/* Rating summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Overall rating */}
        <div className="lg:col-span-1">
          <Card className="border-gray-200">
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex justify-center mb-2">
                {renderStars(Math.round(averageRating))}
              </div>
              <div className="text-sm text-gray-600">
                На основе {totalReviews} отзывов
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rating breakdown */}
        {ratingBreakdown && (
          <div className="lg:col-span-2">
            <Card className="border-gray-200">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = ratingBreakdown[rating as keyof typeof ratingBreakdown] || 0;
                    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 w-12">
                          {rating} звезд
                        </span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Reviews list */}
      <div className="space-y-6">
        {displayedReviews.map((review) => (
          <Card key={review.id} className="border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {review.authorAvatar ? (
                    <div className="relative w-12 h-12 rounded-full overflow-hidden">
                      <Image
                        src={review.authorAvatar}
                        alt={review.authorName}
                        fill
                        className="object-cover"
                      />
                    </div>
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
                        {formatDate(review.date)}
                      </div>
                    </div>
                    {renderStars(review.rating)}
                  </div>

                  <p className="text-gray-700 leading-relaxed mb-3">
                    {review.text}
                  </p>

                  {/* Helpful button */}
                  <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-sm">
                      Полезно {review.helpful ? `(${review.helpful})` : ""}
                    </span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Show more button */}
      {reviews.length > 3 && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? "Показать меньше"
              : `Показать все отзывы (${reviews.length})`}
          </Button>
        </div>
      )}
    </section>
  );
}
