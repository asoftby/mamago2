"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedbackSummary } from "@/server/services/booking/bookingFeedback.service";

// ─── Star display ─────────────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= Math.round(rating)
              ? "fill-[#EF8759] text-[#EF8759]"
              : "fill-stone-100 text-stone-200",
          )}
        />
      ))}
    </div>
  );
}

// ─── Satisfaction level label ─────────────────────────────────────────────────

function getSatisfactionLabel(positiveRate: number): {
  label: string;
  color: string;
} {
  if (positiveRate >= 80) return { label: "Высокая удовлетворённость", color: "text-emerald-700" };
  if (positiveRate >= 60) return { label: "Хорошая удовлетворённость", color: "text-blue-700" };
  if (positiveRate >= 40) return { label: "Средняя удовлетворённость", color: "text-amber-700" };
  return { label: "Низкая удовлетворённость", color: "text-red-700" };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FeedbackSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 space-y-2">
      <div className="h-2.5 w-20 animate-pulse rounded bg-stone-100" />
      <div className="h-5 w-32 animate-pulse rounded bg-stone-100" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingFeedbackSummary() {
  const [data, setData] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/bookings/feedback-summary", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: FeedbackSummary | null) => {
        if (json) setData(json);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FeedbackSkeleton />;
  if (!data || data.feedbackCount === 0) return null;

  const satisfaction = getSatisfactionLabel(data.positiveRate);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
        Отзывы клиентов
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Average rating */}
        <div className="flex items-center gap-2">
          <StarDisplay rating={data.averageRating ?? 0} />
          <span className="text-[18px] font-bold tabular-nums text-stone-900">
            {data.averageRating?.toFixed(1) ?? "—"}
          </span>
          <span className="text-[12px] text-stone-400">
            ({data.feedbackCount} {pluralFeedback(data.feedbackCount)})
          </span>
        </div>

        {/* Satisfaction level */}
        <span className={cn("text-[12px] font-medium", satisfaction.color)}>
          {satisfaction.label}
        </span>
      </div>

      {/* Positive / negative breakdown */}
      {data.feedbackCount >= 3 && (
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[12px] text-stone-500">
              {data.positiveRate}% положительных
            </span>
          </div>
          {data.negativeRate > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-[12px] text-stone-500">
                {data.negativeRate}% отрицательных
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function pluralFeedback(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "отзыв";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "отзыва";
  return "отзывов";
}
