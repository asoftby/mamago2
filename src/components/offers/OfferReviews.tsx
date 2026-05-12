"use client";

import { Star, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferReview } from "@/lib/offer/offerPageTypes";

interface OfferReviewsProps {
  reviews: OfferReview[];
  averageRating?: number;
  totalCount: number;
}

/**
 * Reviews Block — только внутренние mamaGo reviews
 * Desktop: 3 колонки
 * Mobile: horizontal scroll
 * Empty state: мягкая заглушка
 */
export function OfferReviews({ reviews, averageRating, totalCount }: OfferReviewsProps) {
  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[22px] font-bold text-gray-900 lg:text-[24px]">Отзывы</h2>
          {averageRating && reviews.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-[#FFF7F3] px-3 py-1 border border-[#EF8759]/15">
              <Star className="h-3.5 w-3.5 fill-[#EF8759] text-[#EF8759]" />
              <span className="text-[14px] font-bold text-gray-900">{averageRating.toFixed(1)}</span>
              <span className="text-[13px] text-gray-500">({totalCount})</span>
            </div>
          )}
        </div>
        {reviews.length > 3 && (
          <button
            type="button"
            className="text-[14px] font-semibold text-[#EF8759] hover:underline transition-all"
          >
            Все отзывы →
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <MessageCircle className="h-6 w-6 text-gray-400" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-gray-700">Пока нет отзывов</p>
            <p className="mt-1 text-[13px] text-gray-400">Будьте первым, кто оставит отзыв</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: 3 columns */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.slice(0, 6).map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {/* Mobile: horizontal scroll */}
          <div className="flex gap-4 overflow-x-auto -mx-4 px-4 pb-4 sm:hidden snap-x snap-mandatory scrollbar-hide">
            {reviews.map((review) => (
              <div key={review.id} className="snap-start shrink-0 w-[280px]">
                <ReviewCard review={review} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: OfferReview }) {
  const initials = review.authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm h-full">
      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EF8759]/10">
          {review.authorAvatar ? (
            <img
              src={review.authorAvatar}
              alt={review.authorName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-[13px] font-bold text-[#EF8759]">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-gray-900 truncate">{review.authorName}</p>
          <p className="text-[12px] text-gray-400">{review.date}</p>
        </div>
      </div>

      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i < review.rating
                ? "fill-[#EF8759] text-[#EF8759]"
                : "fill-gray-100 text-gray-100"
            )}
          />
        ))}
      </div>

      {/* Text */}
      {review.text && (
        <p className="text-[14px] leading-relaxed text-gray-600 line-clamp-4">
          {review.text}
        </p>
      )}
    </div>
  );
}
