"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Review {
  id: string;
  author: string;
  date: string;
  rating: number;
  text: string;
  avatar?: string;
}

interface EventReviewsProps {
  reviews: Review[];
  averageRating: number;
  totalCount: number;
  onShowAll?: () => void;
}

/**
 * Блок отзывов - короткие, по делу, 2-3 на экран.
 * С кнопкой "Смотреть все отзывы".
 */
export function EventReviews({
  reviews,
  averageRating,
  totalCount,
  onShowAll,
}: EventReviewsProps) {
  if (reviews.length === 0) return null;

  return (
    <section className="border-t border-border/40 py-10">
      {/* Заголовок с рейтингом */}
      <div className="mb-8 flex items-center gap-3">
        <Star className="h-6 w-6 fill-primary text-primary" />
        <h2 className="font-headline text-2xl font-bold text-foreground">
          {averageRating.toFixed(1)} · {totalCount} отзывов
        </h2>
      </div>

      {/* Список отзывов */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.slice(0, 3).map((review) => (
          <div
            key={review.id}
            className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-accent/20 p-5"
          >
            {/* Автор и дата */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {review.author.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">
                  {review.author}
                </p>
                <p className="text-[12px] text-muted-foreground">{review.date}</p>
              </div>
            </div>

            {/* Рейтинг */}
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${
                    i < review.rating
                      ? "fill-primary text-primary"
                      : "text-border"
                  }`}
                />
              ))}
            </div>

            {/* Текст отзыва */}
            <p className="text-[14px] leading-relaxed text-foreground">
              {review.text}
            </p>
          </div>
        ))}
      </div>

      {/* Кнопка "Смотреть все" */}
      {totalCount > 3 && (
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={onShowAll}
            className="w-full sm:w-auto"
          >
            Смотреть все отзывы ({totalCount})
          </Button>
        </div>
      )}
    </section>
  );
}
