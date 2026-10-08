"use client";

import { useEffect, useState } from "react";
import { PhoneVerificationModal } from "@/components/place/PhoneVerificationModal";
import { EMOJI_RATING_OPTIONS, type EmojiRatingType } from "@/lib/content-rating/emojiRating";
import { MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH } from "@/lib/experience/feedback";

export type ExperienceCheckInCandidate = {
  planItemId: string;
  activityId: string;
  title: string;
  plannedDate: string;
  plannedStartsAt: string | null;
};

export type ExperienceCheckInState = {
  id: string;
  planItemId: string;
  title: string;
  plannedDate: string;
  attendance: "ATTENDED" | "NOT_ATTENDED";
  feedbackSentiment: "LIKE" | "NEUTRAL" | "DISLIKE" | null;
  feedbackComment?: string | null;
};

type Sentiment = NonNullable<ExperienceCheckInState["feedbackSentiment"]>;

const sentiments: Record<EmojiRatingType, Sentiment> = {
  like: "LIKE",
  neutral: "NEUTRAL",
  dislike: "DISLIKE",
};

const sentimentLabels: Record<Sentiment, string> = {
  LIKE: "Понравилось",
  NEUTRAL: "Нормально",
  DISLIKE: "Не понравилось",
};

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-BY", { day: "numeric", month: "long" }).format(
    new Date(year!, month! - 1, day!),
  );
}

export function ExperienceCheckIn({
  candidates,
  recentExperiences,
}: {
  candidates: ExperienceCheckInCandidate[];
  recentExperiences: ExperienceCheckInState[];
}) {
  const candidate = candidates[0] ?? null;
  // Revisit only incomplete feedback, never a fully answered visit.
  const [submitted, setSubmitted] = useState<ExperienceCheckInState | null>(
    candidate ? null : recentExperiences.find((item) => item.attendance === "ATTENDED" && !item.feedbackSentiment) ?? null,
  );
  const [selectedSentiment, setSelectedSentiment] = useState<Sentiment | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  const [exitState, setExitState] = useState<"visible" | "leaving" | "hidden">("visible");

  useEffect(() => {
    if (!complete) return;
    const beginExit = window.setTimeout(() => setExitState("leaving"), 2700);
    const hide = window.setTimeout(() => setExitState("hidden"), 3000);
    return () => {
      window.clearTimeout(beginExit);
      window.clearTimeout(hide);
    };
  }, [complete]);

  if ((!candidate && !submitted) || exitState === "hidden") return null;

  async function confirm(attendance: "ATTENDED" | "NOT_ATTENDED") {
    if (!candidate || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/plan/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planItemId: candidate.planItemId, attendance }),
      });
      if (!response.ok) throw new Error("attendance_failed");
      const payload = (await response.json()) as { experience: ExperienceCheckInState };
      setSubmitted({ ...payload.experience, title: candidate.title });
      if (attendance === "NOT_ATTENDED") {
        setMessage("Спасибо, отметили, что вы не были");
        setComplete(true);
      }
    } catch {
      setMessage("Не получилось сохранить ответ. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFeedback() {
    if (!submitted || !selectedSentiment || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/plan/experiences/${submitted.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sentiment: selectedSentiment, comment: comment.trim() || null }),
      });
      if (response.status === 403) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        if (error?.error === "PHONE_NOT_VERIFIED") {
          setPhoneModalOpen(true);
          return;
        }
      }
      if (!response.ok) throw new Error("feedback_failed");
      const payload = (await response.json()) as { experience: ExperienceCheckInState };
      setSubmitted((current) => current ? {
        ...current,
        feedbackSentiment: payload.experience.feedbackSentiment,
        feedbackComment: payload.experience.feedbackComment ?? null,
      } : current);
      setComplete(true);
      setMessage("Спасибо за отзыв!");
    } catch {
      setMessage("Не получилось сохранить отзыв. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const shownTitle = submitted?.title ?? candidate?.title ?? "Событие";
  const shownDate = submitted?.plannedDate ?? candidate?.plannedDate ?? "";

  return (
    <>
      <section
        aria-labelledby="experience-check-in-title"
        className={`mb-8 rounded-2xl border border-[rgba(20,18,16,.12)] bg-[#FAF7F1] p-5 transition-all duration-300 sm:p-6 ${exitState === "leaving" ? "translate-y-2 opacity-0" : "opacity-100"}`}
      >
        <p className="font-mono text-[11px] uppercase tracking-[.14em] text-[var(--primary)]">
          Как прошло?
        </p>
        <h2 id="experience-check-in-title" className="mt-2 text-xl font-semibold text-[#141210]">
          {shownTitle}
        </h2>
        <p className="mt-1 text-sm text-[#6B6258]">{formatDate(shownDate)}</p>

        {!submitted ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm("ATTENDED")}
              className="min-h-11 rounded-xl bg-[#141210] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Да, были
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm("NOT_ATTENDED")}
              className="min-h-11 rounded-xl border border-[rgba(20,18,16,.2)] bg-white px-5 py-3 text-sm font-semibold text-[#141210] disabled:opacity-50"
            >
              Не получилось
            </button>
          </div>
        ) : submitted.attendance === "NOT_ATTENDED" ? (
          <p className="mt-4 font-semibold text-[#3A332B]">Не получилось</p>
        ) : complete || submitted.feedbackSentiment ? (
          <p className="mt-4 font-semibold text-[#3A332B]">
            {submitted.feedbackSentiment ? sentimentLabels[submitted.feedbackSentiment] : "Посещение сохранено"}
          </p>
        ) : (
          <div className="mt-5">
            <p className="font-semibold text-[#141210]">Как вам мероприятие?</p>
            <div role="group" aria-label="Оценка мероприятия" className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3">
              {EMOJI_RATING_OPTIONS.map(({ type, emoji }) => {
                const sentiment = sentiments[type];
                const selected = selectedSentiment === sentiment;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedSentiment(sentiment)}
                    disabled={busy}
                    className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-2 text-center transition-all duration-200 disabled:opacity-50 ${selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20" : "border-neutral-200 hover:border-neutral-400"}`}
                  >
                    <span className="text-4xl leading-none" aria-hidden="true">{emoji}</span>
                    <span className="text-xs font-medium text-[#3A332B]">{sentimentLabels[sentiment]}</span>
                  </button>
                );
              })}
            </div>
            <label htmlFor="experience-feedback-comment" className="mt-5 block text-sm font-medium text-[#141210]">
              Ваш комментарий <span className="font-normal text-[#6B6258]">(необязательно)</span>
            </label>
            <textarea
              id="experience-feedback-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH}
              rows={3}
              disabled={busy}
              placeholder="Расскажите, что понравилось, а что можно улучшить…"
              className="mt-2 w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-[#141210] outline-none focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 disabled:opacity-50"
            />
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={busy || !selectedSentiment}
                onClick={() => void saveFeedback()}
                className="min-h-11 rounded-xl bg-[#141210] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Отправляем…" : "Отправить отзыв"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setComplete(true);
                  setMessage("Можете оставить отзыв позже");
                }}
                className="min-h-11 text-sm font-medium text-[#6B6258] disabled:opacity-50"
              >
                Позже
              </button>
            </div>
          </div>
        )}

        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-[#6B6258]">
          {message}
        </p>
      </section>
      <PhoneVerificationModal
        open={phoneModalOpen}
        reason="plan-feedback"
        onClose={() => setPhoneModalOpen(false)}
        onVerified={() => {
          setPhoneModalOpen(false);
          void saveFeedback();
        }}
      />
    </>
  );
}
