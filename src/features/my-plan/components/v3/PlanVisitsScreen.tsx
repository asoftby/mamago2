"use client";

import { useCallback, useEffect, useState } from "react";
import { PhoneVerificationModal } from "@/components/place/PhoneVerificationModal";
import { MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH } from "@/lib/experience/feedback";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PLAN_FACES, PLAN_FACE_LABEL, PlanFace, sentimentMouth, type PlanSentiment } from "./PlanFace";
import { PlanScreenHeader } from "./PlanScreenHeader";
import {
  fetchPlanExperienceFeed,
  postExperienceFeedback,
  type PlanExperienceRow,
} from "./planExperienceApi";

function monthKey(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  const label = new Date(y!, m! - 1, 1).toLocaleDateString("ru-RU", { month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function visitsLabel(n: number): string {
  const m = n % 10;
  const h = n % 100;
  const word = m === 1 && h !== 11 ? "визит" : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? "визита" : "визитов";
  return `${n} ${word}`;
}

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function RateBox({
  initial,
  initialComment,
  busy,
  onCancel,
  onSave,
}: {
  initial: PlanSentiment | null;
  initialComment: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (sentiment: PlanSentiment, comment: string) => void;
}) {
  const [picked, setPicked] = useState<PlanSentiment | null>(initial);
  const [text, setText] = useState(initialComment);
  return (
    <div className="mt-2.5 border-t border-[var(--mp-line)] pt-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {PLAN_FACES.map((face) => (
          <button
            key={face.sentiment}
            type="button"
            aria-pressed={picked === face.sentiment}
            onClick={() => setPicked(face.sentiment)}
            className={cn(
              "flex h-[62px] flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] text-[12.5px] font-bold transition-colors",
              picked === face.sentiment
                ? "border-[var(--mp-tx)] bg-white text-[var(--mp-tx)]"
                : "border-transparent bg-[var(--mp-bg)] text-[var(--mp-tx2)] hover:bg-[var(--mp-soft)]",
            )}
          >
            <span className="text-[var(--mp-tx)]"><PlanFace mouth={face.mouth} size={24} /></span>
            {face.label}
          </button>
        ))}
      </div>
      {picked ? (
        <>
          <textarea
            rows={2}
            value={text}
            maxLength={MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH}
            onChange={(event) => setText(event.target.value)}
            placeholder="Комментарий — по желанию"
            className="mt-2 block w-full resize-none rounded-xl border border-[var(--mp-line)] bg-[var(--mp-bg)] px-3 py-2.5 text-[14.5px] leading-[1.4] text-[var(--mp-tx)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--mp-line-strong)] focus:bg-white"
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-3 text-sm font-bold text-[var(--mp-tx2)] hover:text-[var(--mp-tx)]">
              Отмена
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(picked, text.trim())}
              className="h-11 rounded-[14px] bg-[var(--mp-tx)] px-[18px] text-sm font-bold text-white disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** «Где мы уже были» — подтверждённые визиты по месяцам с оценкой в один тап. */
export function PlanVisitsScreen({ onBack, onClose }: { onBack: () => void; onClose?: () => void }) {
  const [visits, setVisits] = useState<PlanExperienceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlySuper, setOnlySuper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phoneFor, setPhoneFor] = useState<{ id: string; sentiment: PlanSentiment; comment: string } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchPlanExperienceFeed().then((feed) => {
      if (cancelled) return;
      if (!feed) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setVisits(feed.visits);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rate = useCallback(
    async (id: string, sentiment: PlanSentiment, comment: string) => {
      setBusy(true);
      const result = await postExperienceFeedback(id, sentiment, comment);
      setBusy(false);
      if (result === "phone") {
        setPhoneFor({ id, sentiment, comment });
        return;
      }
      if (result === "error") {
        toast.error("Не получилось сохранить отзыв");
        return;
      }
      setVisits((list) =>
        (list ?? []).map((v) => (v.id === id ? { ...v, feedbackSentiment: sentiment, feedbackComment: comment || null } : v)),
      );
      setOpenId(null);
      toast.success("Спасибо! Оценка сохранена");
    },
    [],
  );

  const groups: Array<{ month: string; items: PlanExperienceRow[] }> = [];
  const shown = (visits ?? []).filter((visit) => !onlySuper || visit.feedbackSentiment === "LIKE");
  for (const visit of shown) {
    const month = monthKey(visit.plannedDate);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(visit);
    else groups.push({ month, items: [visit] });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHeader
        title="Где мы были"
        meta={visits ? visitsLabel(shown.length) : undefined}
        onBack={onBack}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1 md:px-8">
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            aria-pressed={onlySuper}
            onClick={() => setOnlySuper((v) => !v)}
            className={cn(
              "inline-flex h-[46px] shrink-0 items-center gap-2 rounded-full border px-[18px] text-[15px] font-semibold transition-colors",
              onlySuper
                ? "border-[var(--mp-chip-on-bg)] bg-[var(--mp-chip-on-bg)] text-[var(--mp-chip-on-tx)]"
                : "border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)] hover:border-[var(--mp-tx2)]",
            )}
          >
            <PlanFace mouth="super" size={20} />
            Только «Супер»
          </button>
        </div>

        {visits === null && !failed ? (
          <div className="mt-5 space-y-2.5" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)]" />
            ))}
          </div>
        ) : failed ? (
          <div className="mt-5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15px] leading-6 text-[var(--mp-tx2)]">
            Не получилось загрузить визиты.{" "}
            <button type="button" onClick={() => setReloadKey((v) => v + 1)} className="font-bold text-[var(--mp-ac-dark)]">Попробовать снова</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15px] leading-6 text-[var(--mp-tx2)]">
            <b className="font-bold text-[var(--mp-tx)]">{onlySuper ? "Здесь пока пусто." : "Пока пусто."}</b>{" "}
            {onlySuper ? "Нет визитов с оценкой «Супер»." : "Здесь появятся события, на которых вы побывали."}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.month}>
              <div className="mb-2.5 mt-[22px] flex items-center gap-3 px-0.5">
                <span className="text-[19px] font-medium tracking-[-.02em] text-[var(--mp-tx)]">{group.month}</span>
                <i aria-hidden className="h-px flex-1 bg-[var(--mp-line)]" />
              </div>
              <div className="flex flex-col gap-2.5">
              {group.items.map((visit) => (
                <div key={visit.id} className="rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] py-3 pl-4 pr-3.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[16.5px] font-semibold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)]">{visit.title}</div>
                      <div className="mp-font-meta mt-[3px] text-[12px] tracking-[.02em] text-[var(--mp-tx2)]">{dayLabel(visit.plannedDate)}</div>
                    </div>
                    {visit.feedbackSentiment ? (
                      <span
                        title={PLAN_FACE_LABEL[visit.feedbackSentiment]}
                        aria-label={`Оценка: ${PLAN_FACE_LABEL[visit.feedbackSentiment]}`}
                        className="-mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)]"
                      >
                        <PlanFace mouth={sentimentMouth(visit.feedbackSentiment)} size={22} />
                      </span>
                    ) : null}
                  </div>
                  {openId === visit.id ? (
                    <RateBox
                      initial={visit.feedbackSentiment}
                      initialComment={visit.feedbackComment ?? ""}
                      busy={busy}
                      onCancel={() => setOpenId(null)}
                      onSave={(sentiment, comment) => void rate(visit.id, sentiment, comment)}
                    />
                  ) : visit.feedbackSentiment ? (
                    /* Отправленный отзыв не редактируется: API отвечает 409 на изменённую оценку. */
                    visit.feedbackComment ? (
                      <p className="mp-font-display m-0 mt-1.5 text-[14px] italic leading-[1.45] text-[var(--mp-tx)]">«{visit.feedbackComment}»</p>
                    ) : null
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenId(visit.id)}
                      className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--mp-ac-soft)] px-3.5 text-[13.5px] font-bold text-[var(--mp-ac-dark)] transition-colors hover:bg-brand-soft-hover"
                    >
                      <PlanFace mouth="good" size={17} />
                      Как было? Оценить
                    </button>
                  )}
                </div>
              ))}
              </div>
            </div>
          ))
        )}
      </div>
      <PhoneVerificationModal
        open={phoneFor !== null}
        reason="plan-feedback"
        onClose={() => setPhoneFor(null)}
        onVerified={() => {
          const pending = phoneFor;
          setPhoneFor(null);
          if (pending) void rate(pending.id, pending.sentiment, pending.comment);
        }}
      />
    </div>
  );
}
