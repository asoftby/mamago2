"use client";

import { useState, useEffect } from "react";
import { MessageSquarePlus, Quote, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewDialog } from "../ReviewDialog";
import { useCommentGate } from "@/hooks/useCommentGate";
import { motion } from "framer-motion";

interface Review {
  id: string;
  source: "MAMAGO" | "GOOGLE";
  authorName: string;
  authorAvatarUrl?: string | null;
  rating: number;
  text?: string | null;
  publishedAt: Date;
  relativeTimeDescription?: string | null;
  ownerReplyText?: string | null;
  ownerReplyAuthorName?: string | null;
  ownerReplyCreatedAt?: Date | null;
}

function shouldUseRelativeTime(review: Review): boolean {
  if (!review.relativeTimeDescription) return false;
  if (review.source !== "GOOGLE") return true;
  return /[А-Яа-яЁё]/u.test(review.relativeTimeDescription);
}

interface PlaceAllReviewsProps {
  reviews: Review[];
  averageRating?: number;
  totalCount?: number;
  placeId: string;
  placeName: string;
}

export function PlaceAllReviews({
  reviews,
  averageRating,
  totalCount,
  placeId,
  placeName,
}: PlaceAllReviewsProps) {
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const { ensureCanComment } = useCommentGate();

  // Listen for pending action execution
  useEffect(() => {
    const handleExecutePendingAction = (event: Event) => {
      const action = (
        event as CustomEvent<{
          type?: string;
          entityType?: string;
          entityId?: string;
        }>
      ).detail;
      if (
        action.type === "CREATE_REVIEW" &&
        action.entityType === "PLACE" &&
        action.entityId === placeId
      ) {
        // Open review dialog
        setIsReviewDialogOpen(true);
      }
    };

    window.addEventListener(
      "executePendingAction",
      handleExecutePendingAction
    );

    return () => {
      window.removeEventListener(
        "executePendingAction",
        handleExecutePendingAction
      );
    };
  }, [placeId]);

  const handleOpenReviewDialog = () => {
    ensureCanComment({
      entityType: "PLACE",
      entityId: placeId,
      entityName: placeName,
      actionType: "CREATE_REVIEW",
      onAllowed: () => {
        setIsReviewDialogOpen(true);
      },
    });
  };

  const toggleExpanded = (reviewId: string) => {
    setExpandedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isTextLong = (text: string) => {
    return text.length > 300 || text.split("\n").length > 4;
  };

  const getTruncatedText = (text: string) => {
    const lines = text.split("\n");
    if (lines.length > 3) {
      return lines.slice(0, 3).join("\n") + "...";
    }
    if (text.length > 300) {
      return text.slice(0, 300) + "...";
    }
    return text;
  };

  const handleReviewSuccess = () => {
    // Перезагрузить страницу чтобы показать новый отзыв (после модерации)
    // В будущем можно добавить оптимистичное обновление
    window.location.reload();
  };

  // Пустое состояние
  if (reviews.length === 0) {
    return (
      <>
        <section id="reviews" className="scroll-mt-32 space-y-8">
          <SectionHeader
            averageRating={averageRating}
            totalCount={totalCount}
            onReview={handleOpenReviewDialog}
          />
          <div className="rounded-[36px] border border-white/70 bg-white/65 p-12 text-center shadow-[0_28px_90px_rgba(17,19,34,0.08)] backdrop-blur-xl">
            <div className="max-w-md mx-auto space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#EF8759]/18 to-[#6C63FF]/18">
                <MessageSquarePlus className="h-8 w-8 text-[#EF8759]" />
              </div>
              <h3 className="text-2xl font-black text-[#0D1025]">
                Пока нет отзывов
              </h3>
              <p className="text-[#606579]">
                Станьте первым, кто поделится впечатлениями о {placeName}
              </p>
              <Button 
                size="lg" 
                className="mt-4 rounded-full bg-primary px-6 font-black text-primary-foreground shadow-[0_10px_30px_rgba(239,135,89,0.35)] hover:bg-primary/92"
                onClick={handleOpenReviewDialog}
              >
                Оставить первый отзыв
              </Button>
            </div>
          </div>
        </section>

        <ReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          placeId={placeId}
          placeName={placeName}
          onSuccess={handleReviewSuccess}
        />
      </>
    );
  }

  return (
    <>
      <section id="reviews" className="scroll-mt-32 space-y-8">
      <SectionHeader
        averageRating={averageRating}
        totalCount={totalCount}
        onReview={handleOpenReviewDialog}
      />

      <motion.div
        className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-120px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        {reviews.map((review) => {
          const isExpanded = expandedReviews.has(review.id);
          const hasLongText = review.text && isTextLong(review.text);
          const displayText = review.text
            ? isExpanded || !hasLongText
              ? review.text
              : getTruncatedText(review.text)
            : null;

          return (
            <motion.article
              key={review.id}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="break-inside-avoid space-y-5 rounded-[28px] border border-white/70 bg-white/72 p-6 shadow-[0_24px_80px_rgba(17,19,34,0.08)] backdrop-blur-xl"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#EF8759]/20 to-[#6C63FF]/20">
                    {review.authorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={review.authorAvatarUrl}
                        alt={review.authorName}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-black text-[#6C63FF]">
                        {getInitials(review.authorName)}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-[#111322]">
                        {review.authorName}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                          review.source === "GOOGLE"
                            ? "bg-[#F1F4FF] text-[#5D6174]"
                            : "bg-[#FFF0EA] text-[#EF8759]"
                        }`}
                      >
                        {review.source === "GOOGLE" ? "Отзыв из Google" : "Отзыв mamaGo"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating
                                ? "fill-[#EF8759] text-[#EF8759]"
                                : "fill-[#E3E5EE] text-[#E3E5EE]"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-[#8D92A8]">
                        {shouldUseRelativeTime(review)
                          ? review.relativeTimeDescription
                          : formatDate(review.publishedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Text */}
              {displayText && (
                <div className="space-y-2">
                  <Quote className="h-7 w-7 text-[#EF8759]/45" />
                  <p className="whitespace-pre-line text-[15px] leading-8 text-[#555A70]">
                    {displayText}
                  </p>
                  
                  {hasLongText && (
                    <button
                      onClick={() => toggleExpanded(review.id)}
                      className="text-sm font-black text-[#6C63FF] hover:text-[#EF8759]"
                    >
                      {isExpanded ? "Свернуть" : "Читать полностью"}
                    </button>
                  )}
                </div>
              )}

              {review.source === "MAMAGO" && review.ownerReplyText && (
                <div className="ml-4 rounded-[22px] border border-[#EF8759]/16 bg-[#FFF6F1] p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[#111322]">
                        Ответ владельца
                      </span>
                      {review.ownerReplyCreatedAt && (
                        <span className="text-xs text-[#8D92A8]">
                          {formatDate(review.ownerReplyCreatedAt)}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-line text-sm leading-7 text-[#606579]">
                      {review.ownerReplyText}
                    </p>
                  </div>
                </div>
              )}
            </motion.article>
          );
        })}
      </motion.div>

      {reviews.length >= 10 && (
        <div className="text-center pt-4">
          <Button variant="outline" size="lg" className="rounded-full border-white/70 bg-white/70 font-black backdrop-blur-xl">
            Показать еще отзывы
          </Button>
        </div>
      )}
    </section>

    <ReviewDialog
      isOpen={isReviewDialogOpen}
      onClose={() => setIsReviewDialogOpen(false)}
      placeId={placeId}
      placeName={placeName}
      onSuccess={handleReviewSuccess}
    />
  </>
  );
}

function SectionHeader({
  averageRating,
  totalCount,
  onReview,
}: {
  averageRating?: number;
  totalCount?: number;
  onReview: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-4">
        <h2 className="text-[30px] font-black leading-tight tracking-[-0.02em] text-[#0D1025]">
          Живые впечатления родителей
        </h2>
        {averageRating && totalCount && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-black text-[#0D1025]">
              {averageRating.toFixed(1)}
            </span>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(averageRating)
                      ? "fill-[#EF8759] text-[#EF8759]"
                      : "fill-[#E3E5EE] text-[#E3E5EE]"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-[#6B6F80]">
              {totalCount} оценок из mamaGo и Google
            </span>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        onClick={onReview}
        className="h-10 rounded-xl border border-[#ffd8c4] bg-white/70 px-3 text-[13px] font-semibold text-neutral-800 shadow-none hover:bg-white [&_svg]:shrink-0 [&_svg]:text-primary"
      >
        <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Оставить отзыв
      </Button>
    </div>
  );
}
