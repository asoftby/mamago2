"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface RouteRatingBlockProps {
  routeId: string;
  onRate?: (type: "like" | "neutral" | "dislike") => void;
}

type RatingType = "like" | "neutral" | "dislike";

export function RouteRatingBlock({ routeId, onRate }: RouteRatingBlockProps) {
  const [selectedRating, setSelectedRating] = useState<RatingType | null>(null);
  const [counts, setCounts] = useState({ like: 0, neutral: 0, dislike: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/routes/ratings/${routeId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCounts({ like: data.like || 0, neutral: data.neutral || 0, dislike: data.dislike || 0 });
          if (data.myVote) {
            setSelectedRating(data.myVote as RatingType);
            setHasVoted(true);
          }
        }
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [routeId]);

  const handleRate = async (type: RatingType) => {
    if (hasVoted || loading) return;

    // Optimistic update
    setSelectedRating(type);
    setHasVoted(true);
    setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));

    try {
      const res = await fetch("/api/routes/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ routeId, ratingType: type }),
      });

      if (res.status === 409) {
        // Already voted on server — revert optimistic and reload
        setCounts((prev) => ({ ...prev, [type]: prev[type] - 1 }));
        const fresh = await fetch(`/api/routes/ratings/${routeId}`, { credentials: "include" });
        if (fresh.ok) {
          const data = await fresh.json();
          setCounts({ like: data.like || 0, neutral: data.neutral || 0, dislike: data.dislike || 0 });
          if (data.myVote) setSelectedRating(data.myVote as RatingType);
        }
        return;
      }

      if (!res.ok) {
        // Revert on error
        setSelectedRating(null);
        setHasVoted(false);
        setCounts((prev) => ({ ...prev, [type]: prev[type] - 1 }));
        return;
      }

      const data = await res.json();
      if (data.counts) {
        setCounts({ like: data.counts.like, neutral: data.counts.neutral, dislike: data.counts.dislike });
      }

      onRate?.(type);
    } catch {
      // Revert on network error
      setSelectedRating(null);
      setHasVoted(false);
      setCounts((prev) => ({ ...prev, [type]: prev[type] - 1 }));
    }
  };

  const ratings = [
    { type: "like" as const, emoji: "😍" },
    { type: "neutral" as const, emoji: "🙂" },
    { type: "dislike" as const, emoji: "😫" },
  ];

  return (
    <div className="flex flex-col items-center gap-6 py-[30px]">
      <div className="flex w-full items-center gap-4">
        <div className="h-px flex-1 bg-neutral-200" />
        <p
          className="text-[11px] font-medium tracking-[0.18em] text-neutral-400 uppercase"
          style={{ fontFamily: "Menlo, monospace" }}
        >
          Зацени маршрут
        </p>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="flex justify-center items-center gap-4">
        {ratings.map(({ type, emoji }) => {
          const isSelected = selectedRating === type;
          const isDimmed = hasVoted && !isSelected;
          return (
            <button
              key={type}
              onClick={() => handleRate(type)}
              disabled={hasVoted || loading}
              className={cn(
                "flex flex-col items-center justify-center gap-2.5 w-[100px] h-[100px] rounded-2xl bg-white transition-all duration-200",
                "shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-neutral-100",
                !hasVoted && !loading && "hover:scale-105 hover:shadow-[0_4px_14px_rgba(0,0,0,0.1)] active:scale-95 cursor-pointer",
                isDimmed && "opacity-40",
                isSelected && "ring-2 ring-neutral-300",
              )}
              aria-label={`Rate as ${type}`}
            >
              <span className="text-[36px] leading-none select-none">{emoji}</span>
              <span
                className="text-sm text-neutral-500 font-medium"
                style={{ fontFamily: "Menlo, monospace" }}
              >
                {counts[type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
