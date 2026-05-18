"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  bookingId: string;
  onSubmitted: (rating: number) => void;
}

type State = "idle" | "submitting" | "done" | "error";

export function FeedbackWidget({ bookingId, onSubmitted }: Props) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<State>("idle");
  const [expanded, setExpanded] = useState(false);

  const displayRating = hovered || selected;

  async function handleSubmit() {
    if (!selected) return;
    setState("submitting");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating: selected, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // 409 = already exists — treat as success
        if (res.status === 409) {
          setState("done");
          onSubmitted(selected);
          return;
        }
        throw new Error((data as { error?: string }).error ?? "Ошибка");
      }
      setState("done");
      onSubmitted(selected);
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="text-[13px] text-neutral-400">
        Спасибо за отзыв! 🙏
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-neutral-700">Как всё прошло?</p>

      {/* Stars */}
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
        role="group"
        aria-label="Оценка от 1 до 5"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} звезда`}
            onClick={() => {
              setSelected(star);
              setExpanded(true);
            }}
            onMouseEnter={() => setHovered(star)}
            className="p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759] focus-visible:ring-offset-1 rounded"
          >
            <Star
              className={cn(
                "h-7 w-7 transition-colors",
                star <= displayRating
                  ? "fill-amber-400 text-amber-400"
                  : "fill-neutral-100 text-neutral-300",
              )}
            />
          </button>
        ))}
      </div>

      {/* Comment + submit — shown after star selection */}
      {expanded && selected > 0 && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Расскажите подробнее (необязательно)"
            maxLength={1000}
            rows={2}
            className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-[#EF8759] focus:bg-white focus:outline-none transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={state === "submitting"}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#EF8759] px-4 text-[13px] font-semibold text-white transition-all hover:bg-[#e07040] disabled:opacity-60"
            >
              {state === "submitting" ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Отправляем…
                </>
              ) : (
                "Отправить"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setSelected(0);
                setComment("");
              }}
              className="text-[12px] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Отмена
            </button>
          </div>
          {state === "error" && (
            <p className="text-[12px] text-red-500">
              Не удалось отправить. Попробуйте ещё раз.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
