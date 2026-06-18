"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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

function shouldUseRelativeTime(review: Review): boolean {
  if (!review.relativeTimeDescription) return false;
  if (review.source !== "GOOGLE") return true;
  return /[А-Яа-яЁё]/u.test(review.relativeTimeDescription);
}

interface PlaceReviewsSectionProps {
  reviews: Review[];
  placeId: string;
  rating?: number;
  reviewCount?: number;
}

export function PlaceReviewsSection({
  reviews,
  placeId,
  rating,
  reviewCount,
}: PlaceReviewsSectionProps) {
  const [allOpen, setAllOpen] = useState(false);

  if (reviews.length === 0) return null;

  const displayRating = rating ?? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
  const displayCount = reviewCount ?? reviews.length;

  return (
    <section
      id="reviews"
      style={{
        padding: "72px 0 56px",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#ffffff",
      }}
    >
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}
        className="reviews-wrap"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 34,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="kicker-row" style={{ marginBottom: 14 }}>
              <span className="text-kicker">Отзывы</span>
              <span className="kicker-line" style={{ width: 120 }} />
            </div>
            <h2
              style={{
                fontSize: 30,
                margin: 0,
                letterSpacing: "-.02em",
                color: "#141210",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
                whiteSpace: "nowrap",
              }}
            >
              <em style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, color: "var(--primary)" }}>{displayRating.toFixed(1)}</em>
              {" · "}{displayCount} отзывов
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 14,
              color: "#3A332B",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            Читать все →
          </button>
        </div>

        {/* 3-col grid */}
        <div
          className="reviews-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          {reviews.slice(0, 3).map((review, i) => (
            <ReviewCard
              key={review.id}
              review={review}
              layout="grid"
              delay={i * 70}
              onShowMore={() => setAllOpen(true)}
            />
          ))}
        </div>
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

      <style>{`
        @media (max-width: 900px) {
          .reviews-grid { grid-template-columns: 1fr !important; }
          .reviews-wrap { padding: 0 22px !important; }
        }
        @media (max-width: 520px) {
          .reviews-wrap { padding: 0 18px !important; }
        }
      `}</style>
    </section>
  );
}

function ReviewCard({
  review,
  layout,
  delay = 0,
  onShowMore,
}: {
  review: Review;
  layout: "grid" | "list";
  delay?: number;
  onShowMore?: () => void;
}) {
  const isGrid = layout === "grid";
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    if (!isGrid || !review.text?.trim()) {
      setIsTruncated(false);
      return;
    }

    const el = textRef.current;
    if (!el) return;

    const checkTruncation = () => {
      setIsTruncated(el.scrollHeight > el.clientHeight + 1);
    };

    checkTruncation();

    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isGrid, review.text]);

  const initials = review.authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formattedDate = shouldUseRelativeTime(review)
    ? review.relativeTimeDescription!
    : format(new Date(review.publishedAt), "d MMMM yyyy", { locale: ru });

  const replyAt = review.ownerReplyCreatedAt
    ? format(new Date(review.ownerReplyCreatedAt), "d MMMM yyyy", { locale: ru })
    : null;

  return (
    <div
      style={{
        background: "#FAF7F1",
        border: "1px solid rgba(20,18,16,.10)",
        borderRadius: 18,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: isGrid ? 240 : "auto",
      }}
    >
      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 99,
              background: "#FFE8DC",
              color: "#C24E22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "#141210",
              }}
            >
              {review.authorName}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 11,
                color: "rgba(20,18,16,.55)",
                whiteSpace: "nowrap",
              }}
            >
              {formattedDate}
              {review.source === "GOOGLE" && " · Google"}
            </div>
          </div>
        </div>
        <div style={{ color: "#E86A3A", letterSpacing: ".05em", fontSize: 13, flexShrink: 0 }}>
          {"★".repeat(Math.min(review.rating, 5))}
        </div>
      </div>

      {/* Quote text in serif */}
      {review.text && (
        <>
          <p
            ref={textRef}
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: 16,
              lineHeight: 1.3,
              letterSpacing: "-.01em",
              color: "#141210",
              ...(isGrid
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }
                : {}),
            }}
          >
            «{review.text}»
          </p>
          {isGrid && isTruncated && onShowMore ? (
            <button
              type="button"
              onClick={onShowMore}
              style={{
                alignSelf: "flex-start",
                marginTop: -4,
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "#141210",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Показать еще
            </button>
          ) : null}
        </>
      )}

      {/* Owner reply - only in list mode */}
      {review.ownerReplyText?.trim() && layout === "list" && (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid rgba(20,18,16,.10)",
            background: "rgba(20,18,16,.03)",
            padding: "12px 14px",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#3A332B",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#141210" }}>Ответ владельца</div>
          {review.ownerReplyAuthorName && (
            <div style={{ fontSize: 11, color: "rgba(20,18,16,.55)", marginBottom: 4 }}>
              {review.ownerReplyAuthorName}
            </div>
          )}
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{review.ownerReplyText.trim()}</p>
          {replyAt && (
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(20,18,16,.55)" }}>{replyAt}</div>
          )}
        </div>
      )}
    </div>
  );
}
