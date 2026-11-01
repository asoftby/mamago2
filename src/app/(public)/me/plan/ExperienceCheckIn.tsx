"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  canCorrectAttendance?: boolean;
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

function ExperienceCheckInCard({
  candidate,
  initialExperience,
  onDismiss,
  onFinished,
}: {
  candidate: ExperienceCheckInCandidate | null;
  initialExperience: ExperienceCheckInState | null;
  onDismiss: () => void;
  onFinished: () => void;
}) {
  const [submitted, setSubmitted] = useState<ExperienceCheckInState | null>(initialExperience);
  const [selectedSentiment, setSelectedSentiment] = useState<Sentiment | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  const [exitState, setExitState] = useState<"visible" | "leaving" | "hidden">("visible");
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  function postpone() {
    onDismiss();
  }

  useEffect(() => {
    if (!complete) return;
    const beginExit = window.setTimeout(() => setExitState("leaving"), 2700);
    const hide = window.setTimeout(() => {
      setExitState("hidden");
      onFinishedRef.current();
    }, 3000);
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

  async function markNotAttended() {
    if (busy || complete) return;
    if (!submitted) {
      await confirm("NOT_ATTENDED");
      return;
    }
    if (submitted.attendance !== "ATTENDED" ||
        submitted.feedbackSentiment !== null ||
        submitted.canCorrectAttendance === false) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/plan/experiences/${submitted.id}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attendance: "NOT_ATTENDED" }),
      });
      if (!response.ok) throw new Error("attendance_correction_failed");
      setSubmitted((current) => current ? { ...current, attendance: "NOT_ATTENDED" } : current);
      setMessage("Отметили, что вы не были");
      setComplete(true);
    } catch {
      setMessage("Не получилось изменить посещение. Попробуйте ещё раз.");
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
        className={`relative rounded-[24px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5 transition-all duration-300 ${exitState === "leaving" ? "translate-y-2 opacity-0" : "opacity-100"}`}
      >
        <button type="button" aria-label="Закрыть карточку посещения" title="Напомнить завтра" disabled={busy} onClick={postpone}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <p className="pr-10 font-mono text-[11px] uppercase tracking-[.14em] text-[var(--primary)]">
          Как прошло?
        </p>
        <h2 id="experience-check-in-title" className="mt-2 text-xl font-semibold text-[#141210]">
          {shownTitle}
        </h2>
        <p className="mt-1 text-sm text-[#6B6258]">{formatDate(shownDate)}</p>

        {!submitted && !expanded ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" aria-expanded={false} onClick={() => setExpanded(true)}
              className="min-h-11 rounded-xl bg-[#141210] px-4 py-2 text-sm font-semibold text-white">
              Оценить →
            </button>
            <button type="button" disabled={busy} onClick={() => void markNotAttended()} className="min-h-11 px-2 text-sm font-medium text-[#6B6258]">Мы не были</button>
            <button type="button" onClick={postpone} className="min-h-11 px-2 text-xs text-[#6B6258]">Позже</button>
          </div>
        ) : !submitted ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
              Мы не были
            </button>
            <button type="button" disabled={busy} onClick={postpone} className="min-h-11 px-3 text-sm text-[#6B6258] disabled:opacity-50">Позже</button>
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
              {submitted.canCorrectAttendance !== false ? (
                <button type="button" disabled={busy || complete} onClick={() => void markNotAttended()}
                  className="min-h-11 text-sm font-medium text-[#6B6258] disabled:opacity-50">
                  Мы не были
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  postpone();
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

/** Desktop check-in: one-card carousel with explicit navigation. */
export function ExperienceCheckIn({
  candidates,
  recentExperiences,
}: {
  candidates: ExperienceCheckInCandidate[];
  recentExperiences: ExperienceCheckInState[];
}) {
  const cards = [
    ...recentExperiences
      .filter((item) => item.attendance === "ATTENDED" && !item.feedbackSentiment)
      .map((item) => ({ id: `r:${item.id}`, planItemId: item.planItemId, candidate: null, experience: item })),
    ...candidates
      .filter((item) => !recentExperiences.some((recent) => recent.planItemId === item.planItemId))
      .map((item) => ({ id: `a:${item.planItemId}`, planItemId: item.planItemId, candidate: item, experience: null })),
  ];
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [requestedIndex, setRequestedIndex] = useState(0);

  useEffect(() => {
    const snoozed = cards
      .filter((card) => {
        try {
          return Number(window.localStorage.getItem("mamago:experience-snooze:" + card.planItemId)) > Date.now();
        } catch {
          return false;
        }
      })
      .map((card) => card.planItemId);
    if (snoozed.length) {
      setDismissed((current) => Array.from(new Set([...current, ...snoozed])));
    }
  }, [candidates, recentExperiences]);

  const visible = cards.filter((card) => !dismissed.includes(card.planItemId));
  const index = Math.min(requestedIndex, Math.max(0, visible.length - 1));
  const active = visible[index] ?? null;

  function hideCard(planItemId: string) {
    try {
      window.localStorage.setItem("mamago:experience-snooze:" + planItemId, String(Date.now() + 86400000));
    } catch {
      // Closing works even if browser storage is unavailable.
    }
    setDismissed((current) => current.includes(planItemId) ? current : [...current, planItemId]);
  }

  if (!active) return null;

  return (
    <div role="region" aria-roledescription="карусель" aria-label="Оценки прошедших мероприятий" className="min-w-0">
      {visible.length > 1 ? (
        <div className="mb-2 flex items-center justify-end gap-2">
          <span aria-live="polite" className="mr-1 text-xs tabular-nums text-[var(--text-muted)]">
            {index + 1} из {visible.length}
          </span>
          <button type="button" aria-label="Предыдущее посещение" disabled={index === 0}
            onClick={() => setRequestedIndex(Math.max(0, index - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" aria-label="Следующее посещение" disabled={index === visible.length - 1}
            onClick={() => setRequestedIndex(Math.min(visible.length - 1, index + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : null}
      {visible.map((card, cardIndex) => (
        <div key={card.id} hidden={cardIndex !== index} aria-hidden={cardIndex !== index}>
          <ExperienceCheckInCard
            candidate={card.candidate}
            initialExperience={card.experience}
            onDismiss={() => hideCard(card.planItemId)}
            onFinished={() => hideCard(card.planItemId)}
          />
        </div>
      ))}
    </div>
  );
}
