"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PhoneVerificationModal } from "@/components/place/PhoneVerificationModal";
import { MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH } from "@/lib/experience/feedback";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PLAN_FACES, PlanFace, type PlanSentiment } from "./PlanFace";
import {
  postExperienceAttendance,
  postExperienceFeedback,
  type PlanExperienceFeed,
} from "./planExperienceApi";

function formatPlannedDay(dateKey: string, todayIso: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const diff = Math.round((new Date(ty!, tm! - 1, td!).getTime() - date.getTime()) / 86400000);
  if (diff === 1) return "Вчера";
  if (diff === 0) return "Сегодня";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

type Current =
  | { kind: "ask"; planItemId: string; title: string; plannedDate: string }
  | { kind: "rate"; experienceId: string; title: string; plannedDate: string };

/**
 * «Как вам прошедшее?» — один тап по лицу засчитывает визит (attendance = ATTENDED),
 * комментарий необязателен. Использует существующие /api/plan/experiences*.
 */
export function PlanFeedbackCard({
  feed,
  todayIso,
  onChanged,
}: {
  feed: PlanExperienceFeed | null;
  todayIso: string;
  onChanged: () => void;
}) {
  const pending = feed?.awaitingFeedback[0] ?? null;
  const candidate = pending ? null : (feed?.pending[0] ?? null);
  const base: Current | null = pending
    ? { kind: "rate", experienceId: pending.id, title: pending.title, plannedDate: pending.plannedDate }
    : candidate
      ? { kind: "ask", planItemId: candidate.planItemId, title: candidate.title, plannedDate: candidate.plannedDate }
      : null;
  // После тапа по лицу визит засчитан: карточка переходит в режим «оценка» без ожидания перезагрузки ленты.
  const [override, setOverride] = useState<Current | null>(null);
  const current = override ?? base;
  const [picked, setPicked] = useState<PlanSentiment | null>(null);
  const counted = current?.kind === "rate";
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!current || hidden) return null;

  async function pick(sentiment: PlanSentiment) {
    if (!current || busy) return;
    setPicked(sentiment);
    if (current.kind === "rate") return;
    setBusy(true);
    const experience = await postExperienceAttendance(current.planItemId, "ATTENDED");
    setBusy(false);
    if (!experience) {
      setPicked(null);
      toast.error("Не получилось сохранить ответ");
      return;
    }
    setOverride({ kind: "rate", experienceId: experience.id, title: current.title, plannedDate: current.plannedDate });
  }

  async function skip() {
    if (!current || current.kind !== "ask" || busy) return;
    setBusy(true);
    const experience = await postExperienceAttendance(current.planItemId, "NOT_ATTENDED");
    setBusy(false);
    if (!experience) {
      toast.error("Не получилось сохранить ответ");
      return;
    }
    setHidden(true);
    toast.success("Хорошо, вопрос убрали");
    onChanged();
  }

  async function save() {
    if (!current || current.kind !== "rate" || !picked || busy) return;
    setBusy(true);
    const result = await postExperienceFeedback(current.experienceId, picked, comment);
    setBusy(false);
    if (result === "phone") {
      setPhoneOpen(true);
      return;
    }
    if (result === "error") {
      toast.error("Не получилось сохранить отзыв");
      return;
    }
    setHidden(true);
    toast.success("Спасибо! Сохранили в «Где мы уже были»");
    onChanged();
  }

  return (
    <>
      <section className="mb-4 rounded-[20px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-4" aria-label="Как прошло?">
        <p className="text-[13px] font-semibold text-[var(--mp-tx2)]">
          {formatPlannedDay(current.plannedDate, todayIso)}
        </p>
        <h4 className="mb-3.5 mt-1 text-[17px] font-bold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)]">
          Как вам {current.title}?
        </h4>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Оценка">
          {PLAN_FACES.map((face) => (
            <button
              key={face.sentiment}
              type="button"
              disabled={busy}
              aria-pressed={picked === face.sentiment}
              onClick={() => void pick(face.sentiment)}
              className={cn(
                "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] text-[13.5px] font-bold transition-colors disabled:opacity-60",
                picked === face.sentiment
                  ? "border-[var(--mp-tx)] bg-white text-[var(--mp-tx)]"
                  : "border-transparent bg-[var(--mp-bg)] text-[var(--mp-tx2)] hover:bg-[var(--mp-soft)]",
              )}
            >
              <span className="text-[var(--mp-tx)]"><PlanFace mouth={face.mouth} size={30} /></span>
              {face.label}
            </button>
          ))}
        </div>

        {counted ? (
          <>
            <span className="mt-3 inline-flex h-[34px] items-center gap-1.5 rounded-full bg-[#E6F0EA] px-3 text-[13.5px] font-bold text-[#2B6448]">
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
              Визит засчитан
            </span>
            <div className="mt-3 flex gap-2">
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH}
                placeholder="Пару слов? Можно пропустить"
                className="h-12 min-w-0 flex-1 rounded-[14px] border border-[var(--mp-line)] bg-[var(--mp-bg)] px-3.5 text-[15px] text-[var(--mp-tx)] outline-none placeholder:text-[#6F6A65] focus:border-[var(--mp-line-strong)] focus:bg-white"
              />
              <button
                type="button"
                disabled={busy || !picked}
                onClick={() => void save()}
                className="h-12 rounded-[14px] bg-[var(--mp-tx)] px-[18px] text-[15px] font-bold text-white disabled:opacity-50"
              >
                Готово
              </button>
            </div>
          </>
        ) : (
          <div className="mt-1 text-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void skip()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-[15px] font-bold text-[var(--mp-tx2)] transition-colors hover:text-[var(--mp-tx)]"
            >
              Мы не ходили
            </button>
          </div>
        )}
      </section>
      <PhoneVerificationModal
        open={phoneOpen}
        reason="plan-feedback"
        onClose={() => setPhoneOpen(false)}
        onVerified={() => {
          setPhoneOpen(false);
          void save();
        }}
      />
    </>
  );
}
