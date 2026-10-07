"use client";

import { useEffect, useState } from "react";

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
};

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-BY", { day: "numeric", month: "long" }).format(
    new Date(year!, month! - 1, day!),
  );
}

const sentimentLabels = {
  LIKE: "Понравилось",
  NEUTRAL: "Нормально",
  DISLIKE: "Не понравилось",
} as const;

export function ExperienceCheckIn({
  candidates,
}: {
  candidates: ExperienceCheckInCandidate[];
  recentExperiences: ExperienceCheckInState[];
}) {
  const candidate = candidates[0] ?? null;
  const [submitted, setSubmitted] = useState<ExperienceCheckInState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [feedbackSkipped, setFeedbackSkipped] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isComplete =
    submitted?.attendance === "NOT_ATTENDED" ||
    submitted?.feedbackSentiment != null ||
    feedbackSkipped;

  useEffect(() => {
    if (!isComplete) return;
    const startDismiss = window.setTimeout(() => setIsDismissing(true), 3_000);
    const remove = window.setTimeout(() => setDismissed(true), 3_400);
    return () => {
      window.clearTimeout(startDismiss);
      window.clearTimeout(remove);
    };
  }, [isComplete]);

  if (dismissed || (!candidate && !submitted)) return null;

  async function confirm(attendance: "ATTENDED" | "NOT_ATTENDED") {
    if (!candidate || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/plan/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planItemId: candidate.planItemId, attendance }),
      });
      if (!response.ok) throw new Error("attendance_failed");
      const payload = (await response.json()) as { experience: ExperienceCheckInState };
      setSubmitted({ ...payload.experience, title: candidate.title });
      setMessage("Посещение сохранено");
    } catch {
      setMessage("Не получилось сохранить ответ. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function feedback(sentiment: keyof typeof sentimentLabels) {
    if (!submitted || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/plan/experiences/${submitted.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment }),
      });
      if (!response.ok) throw new Error("feedback_failed");
      setSubmitted((current) => current && ({ ...current, feedbackSentiment: sentiment }));
      setMessage("Спасибо, отзыв сохранён");
    } catch {
      setMessage("Не получилось сохранить отзыв. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const shownTitle = submitted?.title ?? candidate?.title ?? "Событие";
  const shownDate = submitted?.plannedDate ?? candidate?.plannedDate ?? "";

  return (
    <section
      aria-labelledby="experience-check-in-title"
      className="mb-8 rounded-2xl border border-[rgba(20,18,16,.12)] bg-[#FAF7F1] p-5 sm:p-6"
      style={{
        opacity: isDismissing ? 0 : 1,
        transform: isDismissing ? "translateY(-8px)" : "translateY(0)",
        maxHeight: isDismissing ? 0 : 700,
        marginBottom: isDismissing ? 0 : undefined,
        paddingTop: isDismissing ? 0 : undefined,
        paddingBottom: isDismissing ? 0 : undefined,
        overflow: "hidden",
        transition: "opacity .32s ease, transform .32s ease, max-height .4s ease, margin .4s ease, padding .4s ease",
      }}
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
      ) : submitted.feedbackSentiment || feedbackSkipped ? (
        <p className="mt-4 font-semibold text-[#3A332B]">
          Были{submitted.feedbackSentiment ? ` · ${sentimentLabels[submitted.feedbackSentiment]}` : ""}
        </p>
      ) : (
        <div className="mt-5">
          <p className="font-semibold text-[#141210]">Были</p>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold text-[#141210]">Как вам?</legend>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {(Object.keys(sentimentLabels) as Array<keyof typeof sentimentLabels>).map((sentiment) => (
                <button
                  key={sentiment}
                  type="button"
                  disabled={busy}
                  onClick={() => void feedback(sentiment)}
                  className="min-h-11 rounded-xl border border-[rgba(20,18,16,.2)] bg-white px-4 py-3 text-sm font-medium text-[#141210] disabled:opacity-50"
                >
                  {sentimentLabels[sentiment]}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFeedbackSkipped(true);
                  setMessage("Посещение сохранено");
                }}
                className="min-h-11 px-4 py-3 text-sm font-medium text-[#6B6258] disabled:opacity-50"
              >
                Пропустить
              </button>
            </div>
          </fieldset>
        </div>
      )}

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-[#6B6258]">
        {message}
      </p>
    </section>
  );
}
