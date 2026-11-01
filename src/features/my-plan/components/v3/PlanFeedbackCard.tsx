"use client";

import { useEffect, useRef, useState } from "react";
import { Check, History, Send, X } from "lucide-react";
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
function FeedbackCard({
  base,
  feedbackV1,
  todayIso,
  onChanged,
  onDismiss,
}: {
  base: Current;
  feedbackV1: boolean;
  todayIso: string;
  onChanged: () => void;
  onDismiss: (snooze: boolean, activeCardId: string) => void;
}) {
  // После тапа по лицу визит засчитан: карточка переходит в режим «оценка» без ожидания перезагрузки ленты.
  const [override, setOverride] = useState<Current | null>(null);
  const current = override ?? base;
  const [picked, setPicked] = useState<PlanSentiment | null>(null);
  const counted = current?.kind === "rate";
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saved, setSaved] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setHidden(true);
      onChanged();
    }, 3000);
  }

  // Selecting a face must persist the rating, not just mark attendance.
  // A comment is optional; Feedback v1 permits adding it after the rating.
  async function persistRating(experienceId: string, sentiment: PlanSentiment, text: string) {
    if (busy) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setBusy(true);
    const result = await postExperienceFeedback(experienceId, sentiment, text);
    setBusy(false);
    if (result === "phone") {
      setPhoneOpen(true);
      return;
    }
    if (result === "error") {
      toast.error("Не получилось сохранить оценку. Попробуйте ещё раз.");
      return;
    }
    setSaved(true);
    scheduleHide();
  }

  if (!current || hidden) return null;

  async function pick(sentiment: PlanSentiment) {
    if (!current || busy || (saved && !feedbackV1)) return;
    setPicked(sentiment);
    if (current.kind === "rate") {
      await persistRating(current.experienceId, sentiment, comment.trim());
      return;
    }
    setBusy(true);
    const experience = await postExperienceAttendance(current.planItemId, "ATTENDED");
    setBusy(false);
    if (!experience) {
      setPicked(null);
      toast.error("Не получилось сохранить посещение");
      return;
    }
    setOverride({ kind: "rate", experienceId: experience.id, title: current.title, plannedDate: current.plannedDate });
    await persistRating(experience.id, sentiment, comment.trim());
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
    if (saved && !comment.trim()) {
      setHidden(true);
      onChanged();
      return;
    }
    if (saved && !feedbackV1) return;
    await persistRating(current.experienceId, picked, comment.trim());
  }

  return (
    <>
      <section className="relative flex h-full min-h-[178px] flex-col gap-1.5 rounded-[24px] bg-[var(--mp-tx)] px-[18px] pb-4 pt-[18px] text-white shadow-[0_14px_30px_-16px_rgba(20,18,16,.55)]" aria-label="Как прошло?">
        <button
          type="button"
          aria-label="Закрыть вопрос о посещении"
          title={saved ? "Закрыть" : "Напомнить завтра"}
          disabled={busy}
          onClick={() => onDismiss(!saved, current.kind === "rate" ? `r:${current.experienceId}` : `a:${current.planItemId}`)}
          className="absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <p className="mp-font-meta pr-10 text-[10px] font-medium uppercase tracking-[.12em] text-white/65">
          {current.kind === "ask" ? "Были ли вы" : "Вы были"} · {formatPlannedDay(current.plannedDate, todayIso)}
        </p>
        <h4 className="mb-2 text-[17px] font-semibold leading-[1.25] tracking-[-.01em] text-white">
          Как вам {current.title}?
        </h4>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Оценка">
          {PLAN_FACES.map((face) => (
            <button
              key={face.sentiment}
              type="button"
              disabled={busy || (saved && !feedbackV1)}
              aria-pressed={picked === face.sentiment}
              onClick={() => void pick(face.sentiment)}
              className={cn(
                "flex h-[60px] flex-col items-center justify-center gap-[3px] rounded-2xl border-[1.5px] text-[13px] font-semibold lowercase transition-colors disabled:opacity-60",
                picked === face.sentiment
                  ? "border-[var(--mp-ac)] bg-white text-[var(--mp-tx)]"
                  : "border-transparent bg-white/80 text-[var(--mp-tx)] hover:bg-white/95",
              )}
            >
              <span className="text-[var(--mp-tx)]"><PlanFace mouth={face.mouth} size={24} /></span>
              {face.label}
            </button>
          ))}
        </div>

        {counted ? (
          <>
            <span className="mt-2 inline-flex h-[34px] items-center gap-1.5 self-start rounded-full bg-[var(--success-soft)] px-3 text-[13.5px] font-bold text-[var(--success-hover)]">
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
              Визит засчитан
            </span>
            {saved ? (
              <p role="status" className="mt-2 text-[13px] font-semibold text-white">Оценка сохранена. Карточка закроется автоматически.</p>
            ) : (
              <p role="status" className="mt-2 text-[13px] text-white/80">
                {busy ? "Сохраняем оценку…" : "Выберите оценку или отправьте выбранную. Комментарий необязателен."}
              </p>
            )}
            {!saved || feedbackV1 ? (
              <div className="relative mt-3 w-full">
              <input
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  if (hideTimer.current) clearTimeout(hideTimer.current);
                }}
                onFocus={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void save(); } }}
                maxLength={MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH}
                placeholder="Пару слов? Можно пропустить"
                aria-label="Комментарий о посещении"
                className="h-12 w-full min-w-0 rounded-[14px] border border-transparent bg-white py-2 pl-3.5 pr-14 text-[15px] text-[var(--mp-tx)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--mp-line-strong)] focus:bg-white"
              />
              <button
                type="button"
                aria-label="Отправить отзыв"
                title="Отправить отзыв"
                disabled={busy || !picked}
                onClick={() => void save()}
                className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-[11px] bg-[var(--mp-tx)] text-white transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Send className="h-5 w-5" aria-hidden="true" />
              </button>
              </div>
            ) : null}
          </>
        ) : (
          <div>
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH}
              placeholder="Комментарий по желанию"
              aria-label="Необязательный комментарий к оценке"
              className="mt-2 h-10 w-full rounded-xl bg-white px-3 text-[13px] text-[var(--mp-tx)] placeholder:text-[var(--text-muted)]"
            />
            <div className="text-center">
              <button
              type="button"
              disabled={busy}
              onClick={() => void skip()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-[13.5px] font-medium text-white/75 underline decoration-white/35 underline-offset-[3px] transition-colors hover:text-white"
            >
                Мы не ходили
              </button>
            </div>
          </div>
        )}
      </section>
      <PhoneVerificationModal
        open={phoneOpen}
        reason="plan-feedback"
        onClose={() => setPhoneOpen(false)}
        onVerified={() => {
          setPhoneOpen(false);
          if (current.kind === "rate" && picked) {
            void persistRating(current.experienceId, picked, comment.trim());
          }
        }}
      />
    </>
  );
}

const MAX_CARDS = 5;

/**
 * Лента карточек «Как вам …?» (по одной на визит, ждущий оценки) + карточка «Все визиты».
 * Точки под лентой показывают текущую карточку.
 */
export function PlanFeedbackCard({
  feed,
  todayIso,
  onChanged,
  onOpenVisits,
}: {
  feed: PlanExperienceFeed | null;
  todayIso: string;
  onChanged: () => void;
  onOpenVisits: () => void;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  // A dismissed pending question stays out of the modal for the next 24h.
  useEffect(() => {
    if (!feed) return;
    const ids = [
      ...feed.awaitingFeedback.map((row) => `r:${row.id}`),
      ...feed.pending.map((row) => `a:${row.planItemId}`),
    ];
    const snoozed = ids.filter((id) => {
      try {
        return Number(window.localStorage.getItem("mamago:plan-feedback-snooze:" + id)) > Date.now();
      } catch {
        return false;
      }
    });
    if (snoozed.length > 0) {
      setHidden((current) => Array.from(new Set([...current, ...snoozed])));
    }
  }, [feed]);
  const cards: Array<{ id: string; base: Current }> = [
    ...(feed?.awaitingFeedback ?? []).map((row) => ({
      id: `r:${row.id}`,
      base: { kind: "rate", experienceId: row.id, title: row.title, plannedDate: row.plannedDate } as Current,
    })),
    ...(feed?.pending ?? []).map((row) => ({
      id: `a:${row.planItemId}`,
      base: { kind: "ask", planItemId: row.planItemId, title: row.title, plannedDate: row.plannedDate } as Current,
    })),
  ]
    .filter((card) => !hidden.includes(card.id))
    .slice(0, MAX_CARDS);
  // History remains reachable after the last feedback card has been completed.
  if (cards.length === 0 && !(feed?.visits.length)) return null;
  const feedbackV1 = feed?.feedbackV1Enabled === true;

  return (
    <div className="mb-3">
      <div
        onScroll={(event) => setIndex(Math.round(event.currentTarget.scrollLeft / 310))}
        className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 [scrollbar-width:none] md:-mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <div key={card.id} className="w-[300px] shrink-0 snap-start scroll-ml-5">
            <FeedbackCard
              base={card.base}
              feedbackV1={feedbackV1}
              todayIso={todayIso}
              onChanged={() => {
                setHidden((list) => [...list, card.id]);
                onChanged();
              }}
              onDismiss={(snooze, activeCardId) => {
                if (snooze) {
                  try {
                    const until = String(Date.now() + 86400000);
                    // An "ask" card may become a "rate" card after confirming
                    // attendance. Snooze both identities to survive a reload.
                    for (const id of new Set([card.id, activeCardId])) {
                      window.localStorage.setItem("mamago:plan-feedback-snooze:" + id, until);
                    }
                  } catch {
                    // Closing must still work if storage is unavailable.
                  }
                }
                setHidden((list) => [...list, card.id]);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={onOpenVisits}
          className="flex w-[150px] shrink-0 snap-start flex-col items-start justify-center gap-2 rounded-[24px] border border-[var(--mp-line)] bg-[var(--mp-card)] px-[18px] py-4 text-left transition-colors hover:border-[var(--mp-tx)]"
        >
          <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)]">
            <History className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
          </span>
          <b className="text-[15px] font-semibold text-[var(--mp-tx)]">Все визиты</b>
          <span className="mp-font-meta text-[11px] text-[var(--mp-tx2)]">история →</span>
        </button>
      </div>
      {cards.length > 1 ? (
        <div className="mt-3 flex justify-center gap-[5px]" aria-hidden>
          {cards.map((card, i) => (
            <i key={card.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-[22px] bg-[var(--mp-tx)]" : "w-1.5 bg-[var(--mp-line-strong)]")} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
