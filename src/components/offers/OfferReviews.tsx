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
 * Reviews Block — editorial style.
 *
 * Отзыв остаётся крупным и спокойным, но без отдельного display-serif слоя,
 * чтобы типографика страницы предложения держалась на основном интерфейсном шрифте.
 */
export function OfferReviews({ reviews, averageRating, totalCount }: OfferReviewsProps) {
  return (
    <section className="space-y-7">
      {/* Editorial header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3.5 mb-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-400">
              05 — Отзывы
            </span>
            <span className="flex-1 h-px bg-gray-100 max-w-[180px]" />
          </div>
          <h2 className="font-sans text-[36px] lg:text-[44px] font-semibold tracking-[-0.02em] leading-[0.95] text-gray-900 whitespace-nowrap">
            {averageRating && reviews.length > 0 ? (
              <>
                <span className="italic">{averageRating.toFixed(1)}</span>
                <span className="text-gray-300"> · </span>
                <span>{totalCount} отзывов</span>
              </>
            ) : (
              <span>Отзывы</span>
            )}
          </h2>
        </div>

        {reviews.length > 3 && (
          <button
            type="button"
            className="text-[14px] font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 hover:decoration-[#EF8759] hover:text-[#C2522A] transition-colors whitespace-nowrap"
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
          {/* Desktop / tablet */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {reviews.slice(0, 6).map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {/* Mobile horizontal */}
          <div className="flex gap-3.5 overflow-x-auto -mx-4 px-4 pb-4 sm:hidden snap-x snap-mandatory scrollbar-hide">
            {reviews.map((review) => (
              <div key={review.id} className="snap-start shrink-0 w-[300px]">
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
    <article className="flex h-full min-h-[220px] flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      {/* Author row */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFF7F3]">
            {review.authorAvatar ? (
              <img
                src={review.authorAvatar}
                alt={review.authorName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[13px] font-bold text-[#C2522A]">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-gray-900 truncate">
              {review.authorName}
            </p>
            <p className="font-mono text-[11px] text-gray-400 truncate">{review.date}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-3 w-3",
                i < review.rating
                  ? "fill-[#EF8759] text-[#EF8759]"
                  : "fill-gray-100 text-gray-100",
              )}
            />
          ))}
        </div>
      </header>

      {/* Quote */}
      {review.text && (
        <blockquote className="font-sans text-[22px] font-medium leading-[1.3] tracking-[-0.005em] text-gray-900 line-clamp-5">
          «{review.text}»
        </blockquote>
      )}
    </article>
  );
}
