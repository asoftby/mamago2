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
  legacyMode?: boolean;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  googleMapsUrl?: string | null;
}

export function PlaceReviewsSection({
  reviews,
  placeId,
  rating,
  legacyMode = false,
  googleRating,
  googleReviewCount,
  googleMapsUrl,
}: PlaceReviewsSectionProps) {
  const [allOpen, setAllOpen] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "MAMAGO" | "GOOGLE">("ALL");

  if (reviews.length === 0) return null;

  const displayRating = rating ?? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
  const displayCount = reviews.length;
  const googleAvailable = reviews.filter(r => r.source === "GOOGLE").length;
  const mamagoAvailable = reviews.filter(r => r.source === "MAMAGO").length;
  const shown = filter === "ALL" ? reviews : reviews.filter(r => r.source === filter);

  return (
    <section
      id="reviews"
      style={{
        padding: "72px 0 56px",
        background: "#ffffff",
      }}
    >
      <div className="reviews-wrap mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-7">
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
              className="text-[26px] leading-tight sm:text-[30px]"
              style={{
                margin: 0,
                letterSpacing: "-.02em",
                color: "#141210",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
              }}
            >
              {legacyMode ? (
                <>Ранее опубликованные отзывы mamaGo · {reviews.length}</>
              ) : (
                <><em style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, color: "var(--primary)" }}>{googleRating != null ? googleRating.toFixed(1) : displayRating.toFixed(1)}</em>{" · "}{googleReviewCount != null && googleReviewCount > 0 ? `${googleReviewCount} оценок Google` : `${displayCount} доступных отзывов`}</>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            className="inline-flex min-h-11 items-center rounded-lg px-2"
            style={{
              background: "none",
              border: "none",
              fontSize: 14,
              color: "#3A332B",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            Читать отзывы →
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
            />
          ))}
        </div>
        {!legacyMode && <p className="mt-3 text-sm text-muted-foreground">Доступно для чтения на mamaGo: {displayCount} ({mamagoAvailable} mamaGo, {googleAvailable} Google). Количество оценок Google не равно количеству доступных текстов.</p>}
        {!legacyMode && googleMapsUrl && <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline underline-offset-4">Все отзывы на Google Картах ↗</a>}
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
              Доступные отзывы
              <span className="ml-2 font-normal text-gray-500">({shown.length})</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Полный список отзывов о месте
            </DialogDescription>
          </DialogHeader>
          {!legacyMode && <div className="flex flex-wrap gap-2 border-b px-6 py-3">
            {([["ALL", "Все", reviews.length], ["MAMAGO", "mamaGo", mamagoAvailable], ["GOOGLE", "Google", googleAvailable]] as const).map(([value, label, count]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("rounded-full border px-3 py-1.5 text-sm", filter === value ? "border-primary bg-primary/10 text-primary" : "border-border")}>{label} · {count}</button>
            ))}
          </div>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="space-y-4 pr-1 pb-2">
              {shown.map((review) => (
                <ReviewCard key={review.id} review={review} layout="list" />
              ))}
            </div>
            {shown.length === 0 && <p className="text-sm text-muted-foreground">Пока нет отзывов этого источника.</p>}
            {!legacyMode && googleMapsUrl && <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm underline underline-offset-4">Все отзывы на Google Картах ↗</a>}
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @media (max-width: 900px) {
          .reviews-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function ReviewCard({
  review,
  layout,
  delay = 0,
}: {
  review: Review;
  layout: "grid" | "list";
  delay?: number;
}) {
  const isGrid = layout === "grid";
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    if (!isGrid || expanded || !review.text?.trim()) {
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
  }, [isGrid, review.text, expanded]);

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
              ...(isGrid && !expanded
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
          {isGrid && (isTruncated || expanded) ? (
            <button
              type="button"
              onClick={() => setExpanded(value => !value)}
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
              {expanded ? "Свернуть" : "Показать ещё"}
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
