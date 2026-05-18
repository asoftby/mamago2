"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingFeedbackCardProps {
  bookingId: string;
  /** Название предложения/события для контекста */
  title?: string;
  onDismiss?: () => void;
  onSubmitted?: (rating: number) => void;
}

// ─── Star rating ──────────────────────────────────────────────────────────────

function StarRating({
  value,
  hovered,
  onHover,
  onLeave,
  onSelect,
  disabled,
}: {
  value: number;
  hovered: number;
  onHover: (n: number) => void;
  onLeave: () => void;
  onSelect: (n: number) => void;
  disabled: boolean;
}) {
  const active = hovered > 0 ? hovered : value;

  return (
    <div
      className="flex items-center gap-1"
      onMouseLeave={onLeave}
      role="group"
      aria-label="Оценка"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} звезда`}
          onClick={() => onSelect(n)}
          onMouseEnter={() => onHover(n)}
          className={cn(
            "rounded p-0.5 transition-transform active:scale-90 disabled:pointer-events-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/50",
          )}
        >
          <Star
            className={cn(
              "h-8 w-8 transition-colors",
              n <= active
                ? "fill-[#EF8759] text-[#EF8759]"
                : "fill-stone-100 text-stone-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Rating label ─────────────────────────────────────────────────────────────

const RATING_LABELS: Record<number, string> = {
  1: "Очень плохо",
  2: "Плохо",
  3: "Нормально",
  4: "Хорошо",
  5: "Отлично",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingFeedbackCard({
  bookingId,
  title,
  onDismiss,
  onSubmitted,
}: BookingFeedbackCardProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/bookings/${bookingId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
        }),
      });

      if (res.status === 409) {
        // Already submitted — treat as success
        setSubmitted(true);
        onSubmitted?.(rating);
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось отправить отзыв");
        return;
      }

      setSubmitted(true);
      onSubmitted?.(rating);
    } catch {
      setError("Не удалось отправить отзыв. Проверьте соединение.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submitted state ──
  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🙏</span>
          <div>
            <p className="text-[14px] font-semibold text-emerald-800">Спасибо за отзыв!</p>
            <p className="text-[12px] text-emerald-600">Ваша оценка помогает улучшать сервис</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[14px] font-semibold text-stone-900">Как всё прошло?</p>
          {title && (
            <p className="text-[12px] text-stone-400 mt-0.5 line-clamp-1">{title}</p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Закрыть"
            className="shrink-0 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Stars ── */}
      <div className="flex flex-col items-center gap-2 py-2">
        <StarRating
          value={rating}
          hovered={hovered}
          onHover={setHovered}
          onLeave={() => setHovered(0)}
          onSelect={setRating}
          disabled={submitting}
        />
        {/* Rating label */}
        <p
          className={cn(
            "text-[13px] font-medium transition-colors h-5",
            rating > 0 ? "text-[#EF8759]" : "text-stone-300",
          )}
        >
          {rating > 0 ? RATING_LABELS[rating] : "Выберите оценку"}
        </p>
      </div>

      {/* ── Comment (shown after star selection) ── */}
      {rating > 0 && (
        <div className="mt-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            maxLength={1000}
            rows={2}
            disabled={submitting}
            className={cn(
              "w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5",
              "text-[13px] text-stone-700 placeholder:text-stone-400",
              "focus:border-stone-300 focus:bg-white focus:outline-none focus:ring-0",
              "disabled:opacity-50 transition-colors",
            )}
          />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      )}

      {/* ── Actions ── */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl px-4",
            "text-[13px] font-medium transition-colors",
            "disabled:pointer-events-none disabled:opacity-40",
            rating > 0
              ? "bg-[#EF8759] text-white hover:bg-[#E07040]"
              : "bg-stone-100 text-stone-400",
          )}
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Отправка…
            </span>
          ) : (
            "Отправить"
          )}
        </button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded-xl px-3 text-[13px] text-stone-500 hover:text-stone-700 transition-colors disabled:opacity-40"
          >
            Позже
          </button>
        )}
      </div>
    </div>
  );
}
