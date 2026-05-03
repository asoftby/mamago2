"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface RouteRatingBlockProps {
  routeId: string;
  likesCount?: number;
  neutralCount?: number;
  dislikesCount?: number;
  onRate?: (type: "like" | "neutral" | "dislike") => void;
}

type RatingType = "like" | "neutral" | "dislike";

export function RouteRatingBlock({
  routeId,
  likesCount = 0,
  neutralCount = 0,
  dislikesCount = 0,
  onRate,
}: RouteRatingBlockProps) {
  const [selectedRating, setSelectedRating] = useState<RatingType | null>(null);
  const [counts, setCounts] = useState({
    like: likesCount,
    neutral: neutralCount,
    dislike: dislikesCount,
  });
  const [hasVoted, setHasVoted] = useState(false);

  // Load initial counts from server
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const res = await fetch(`/api/routes/ratings/${routeId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCounts({
            like: data.like || 0,
            neutral: data.neutral || 0,
            dislike: data.dislike || 0,
          });
        }
      } catch (error) {
        console.error("Failed to load route ratings:", error);
      }
    };

    loadCounts();
  }, [routeId]);

  // Check if user has already voted on this route
  useEffect(() => {
    const votedRoutes = JSON.parse(localStorage.getItem("votedRoutes") || "{}");
    if (votedRoutes[routeId]) {
      setSelectedRating(votedRoutes[routeId]);
      setHasVoted(true);
    }
  }, [routeId]);

  const handleRate = async (type: RatingType) => {
    if (hasVoted) return; // Prevent duplicate votes

    try {
      // Save vote to backend
      const res = await fetch("/api/routes/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          routeId,
          ratingType: type,
        }),
      });

      if (res.status === 409) {
        // Already voted
        setHasVoted(true);
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save rating");
      }

      const data = await res.json();

      // Update local state with counts from server
      if (data.counts) {
        setCounts({
          like: data.counts.like,
          neutral: data.counts.neutral,
          dislike: data.counts.dislike,
        });
      }

      // Update local state
      setSelectedRating(type);
      setHasVoted(true);

      // Save to localStorage to prevent duplicate votes
      const votedRoutes = JSON.parse(localStorage.getItem("votedRoutes") || "{}");
      votedRoutes[routeId] = type;
      localStorage.setItem("votedRoutes", JSON.stringify(votedRoutes));

      onRate?.(type);
    } catch (error) {
      console.error("Failed to save rating:", error);
    }
  };

  const ratings = [
    { type: "like" as const, emoji: "😍", count: counts.like, label: "Нравится" },
    { type: "neutral" as const, emoji: "🙂", count: counts.neutral, label: "Нормально" },
    { type: "dislike" as const, emoji: "😫", count: counts.dislike, label: "Не нравится" },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Title */}
      <p className="text-sm font-medium text-neutral-700">
        Зацени маршрут
      </p>

      {/* Rating buttons - no background, just emojis and counts */}
      <div className="flex justify-center items-end gap-8">
        {ratings.map(({ type, emoji, count }) => {
          try {
            return (
              <button
                key={type}
                onClick={() => handleRate(type)}
                disabled={hasVoted && selectedRating !== type}
                className={cn(
                  "flex flex-col items-center gap-2 transition-all duration-200",
                  "hover:scale-110 active:scale-95",
                  hasVoted && selectedRating !== type && "opacity-50 cursor-not-allowed",
                  selectedRating === type && "ring-2 ring-offset-2 ring-neutral-300 rounded-xl p-2",
                )}
                aria-label={`Rate as ${type}`}
              >
                {/* Emoji - 10% larger (31px instead of 28px) */}
                <span className="text-[31px] leading-none select-none">
                  {emoji}
                </span>
                {/* Vote count */}
                <span className="text-xs text-neutral-500 font-medium">
                  {count}
                </span>
              </button>
            );
          } catch (e) {
            console.error("Error rendering rating button:", e);
            return null;
          }
        })}
      </div>
    </div>
  );
}
