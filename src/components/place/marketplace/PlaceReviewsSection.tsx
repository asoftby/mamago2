"use client";

import { ArrowRight, Star } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Review {
  id: string;
  source: "MAMAGO" | "GOOGLE";
  authorName: string;
  authorAvatarUrl?: string | null;
  rating: number;
  text?: string | null;
  publishedAt: Date | string;
  relativeTimeDescription?: string | null;
  ownerReplyText?: string | null;
  ownerReplyAuthorName?: string | null;
  ownerReplyCreatedAt?: Date | string | null;
}

interface PlaceReviewsSectionProps {
  reviews: Review[];
  placeId: string;
}

export function PlaceReviewsSection({ reviews, placeId }: PlaceReviewsSectionProps) {
  const [allOpen, setAllOpen] = useState(false);

  if (reviews.length === 0) {
    return null;
  }

  return (
    <section id="reviews" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Отзывы</h2>
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium text-[#EF8759] transition hover:text-[#EF8759]/80"
          onClick={() => setAllOpen(true)}
          aria-expanded={allOpen}
          aria-controls={`reviews-dialog-${placeId}`}
        >
          Все отзывы
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {reviews.slice(0, 6).map((review) => (
          <ReviewCard key={review.id} review={review} layout="carousel" />
        ))}
      </div>

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent
          id={`reviews-dialog-${placeId}`}
          className={cn(
            "flex max-h-[min(85dvh,800px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-gray-100 bg-background px-6 pb-4 pt-6 pr-14 text-left">
            <DialogTitle className="text-xl text-gray-900">
              Все отзывы
              <span className="ml-2 font-normal text-gray-500">({reviews.length})</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Полный список отзывов о месте
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="space-y-4 pr-1 pb-2">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} layout="list" />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ReviewCard({
  review,
  layout,
}: {
  review: Review;
  layout: "carousel" | "list";
}) {
  const isCarousel = layout === "carousel";

  const initials = review.authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formattedDate =
    review.relativeTimeDescription ||
    format(new Date(review.publishedAt), "d MMMM yyyy", { locale: ru });

  const replyAt = review.ownerReplyCreatedAt
    ? format(new Date(review.ownerReplyCreatedAt), "d MMMM yyyy", { locale: ru })
    : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5",
        isCarousel ? "w-[320px] flex-shrink-0" : "w-full",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EF8759]/10">
          {review.authorAvatarUrl ? (
            <Image
              src={review.authorAvatarUrl}
              alt={review.authorName}
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-[#EF8759]">{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">{review.authorName}</div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>{formattedDate}</span>
            {review.source === "GOOGLE" && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">Google</span>
            )}
            {review.source === "MAMAGO" && (
              <span className="rounded-full bg-[#EF8759]/10 px-2 py-0.5 text-xs text-[#EF8759]">
                mamaGo
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-4 w-4",
              star <= review.rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200",
            )}
          />
        ))}
      </div>

      {review.text && (
        <p
          className={cn(
            "text-sm leading-relaxed text-gray-700",
            isCarousel && "line-clamp-4",
          )}
        >
          {review.text}
        </p>
      )}

      {review.ownerReplyText?.trim() && layout === "list" && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
          <div className="mb-2 font-semibold text-gray-900">Ответ владельца</div>
          {review.ownerReplyAuthorName && (
            <div className="mb-1 text-xs font-medium text-gray-500">{review.ownerReplyAuthorName}</div>
          )}
          <p className="whitespace-pre-wrap">{review.ownerReplyText.trim()}</p>
          {replyAt && <div className="mt-2 text-xs text-gray-500">{replyAt}</div>}
        </div>
      )}
    </div>
  );
}
