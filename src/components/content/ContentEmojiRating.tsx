"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  EMOJI_RATING_OPTIONS,
  emptyEmojiRatingCounts,
  type EmojiRatingCounts,
  type EmojiRatingType,
} from "@/lib/content-rating/emojiRating";

export type ContentEmojiRatingEntityType = "ROUTE" | "ARTICLE";

export type ContentEmojiRatingProps = {
  entityType: ContentEmojiRatingEntityType;
  entityId: string;
  title: string;
  getPath: string;
  postPath: string;
  postBodyKey: "routeId" | "articleId";
  onRate?: (type: EmojiRatingType) => void;
  className?: string;
};

export function ContentEmojiRating({
  entityType,
  entityId,
  title,
  getPath,
  postPath,
  postBodyKey,
  onRate,
  className,
}: ContentEmojiRatingProps) {
  const reactId = useId();
  const titleId = `content-emoji-rating-title-${entityType}-${entityId}-${reactId}`;
  const liveId = `content-emoji-rating-live-${entityType}-${entityId}-${reactId}`;

  const [selectedRating, setSelectedRating] = useState<EmojiRatingType | null>(
    null,
  );
  const [counts, setCounts] = useState<EmojiRatingCounts>(emptyEmojiRatingCounts);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(getPath, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as EmojiRatingCounts & {
          myVote?: string | null;
        };
        if (cancelled) return;
        setCounts({
          like: data.like || 0,
          neutral: data.neutral || 0,
          dislike: data.dislike || 0,
        });
        if (data.myVote === "like" || data.myVote === "neutral" || data.myVote === "dislike") {
          setSelectedRating(data.myVote);
          setHasVoted(true);
          setLiveMessage("Спасибо за оценку");
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [getPath]);

  const handleRate = async (type: EmojiRatingType) => {
    if (hasVoted || loading) return;

    setError(null);
    setSelectedRating(type);
    setHasVoted(true);
    setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
    setLiveMessage("Спасибо за оценку");

    try {
      const res = await fetch(postPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [postBodyKey]: entityId, ratingType: type }),
      });

      if (res.status === 409) {
        setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
        const fresh = await fetch(getPath, { credentials: "include" });
        if (fresh.ok) {
          const data = (await fresh.json()) as EmojiRatingCounts & {
            myVote?: string | null;
          };
          setCounts({
            like: data.like || 0,
            neutral: data.neutral || 0,
            dislike: data.dislike || 0,
          });
          if (
            data.myVote === "like" ||
            data.myVote === "neutral" ||
            data.myVote === "dislike"
          ) {
            setSelectedRating(data.myVote);
            setHasVoted(true);
          }
        }
        return;
      }

      if (!res.ok) {
        setSelectedRating(null);
        setHasVoted(false);
        setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
        setLiveMessage("");
        setError("Не удалось сохранить оценку. Попробуйте ещё раз.");
        return;
      }

      const data = (await res.json()) as { counts?: EmojiRatingCounts };
      if (data.counts) {
        setCounts({
          like: data.counts.like,
          neutral: data.counts.neutral,
          dislike: data.counts.dislike,
        });
      }
      onRate?.(type);
    } catch {
      setSelectedRating(null);
      setHasVoted(false);
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      setLiveMessage("");
      setError("Не удалось сохранить оценку. Попробуйте ещё раз.");
    }
  };

  return (
    <div
      className={cn("flex flex-col items-center gap-6 py-[30px]", className)}
      role="group"
      aria-labelledby={titleId}
    >
      <div className="flex w-full items-center gap-4">
        <div className="h-px flex-1 bg-neutral-200" />
        <p
          id={titleId}
          className="text-[11px] font-medium tracking-[0.18em] text-neutral-400 uppercase font-mono"
        >
          {title}
        </p>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="flex justify-center items-center gap-4">
        {EMOJI_RATING_OPTIONS.map(({ type, emoji, labelRu }) => {
          const isSelected = selectedRating === type;
          const isDimmed = hasVoted && !isSelected;
          return (
            <button
              key={type}
              type="button"
              onClick={() => void handleRate(type)}
              disabled={hasVoted || loading}
              aria-pressed={isSelected}
              aria-label={`${labelRu}${hasVoted ? (isSelected ? ", выбрано" : "") : ""}`}
              className={cn(
                "flex flex-col items-center justify-center gap-2.5 w-[100px] h-[100px] rounded-2xl bg-white transition-all duration-200",
                "shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-neutral-100",
                "motion-reduce:transition-none motion-reduce:hover:scale-100",
                !hasVoted &&
                  !loading &&
                  "hover:scale-105 hover:shadow-[0_4px_14px_rgba(0,0,0,0.1)] active:scale-95 cursor-pointer",
                isDimmed && "opacity-40",
                isSelected && "ring-2 ring-neutral-300",
              )}
            >
              <span className="text-[36px] leading-none select-none" aria-hidden>
                {emoji}
              </span>
              <span className="text-sm text-neutral-500 font-medium font-mono">
                {counts[type]}
              </span>
            </button>
          );
        })}
      </div>

      <p id={liveId} className="sr-only" aria-live="polite">
        {liveMessage}
      </p>

      {error ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="text-sm text-primary hover:underline underline-offset-2"
            onClick={() => {
              setError(null);
              setHasVoted(false);
              setSelectedRating(null);
            }}
          >
            Повторить
          </button>
        </div>
      ) : null}

      {hasVoted && !error ? (
        <p className="text-sm text-muted-foreground font-serif" aria-hidden>
          Спасибо!
        </p>
      ) : null}
    </div>
  );
}
