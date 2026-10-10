"use client";

import { useCallback, useEffect, useState } from "react";
import { PhoneVerificationModal } from "@/components/place/PhoneVerificationModal";
import { MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH } from "@/lib/experience/feedback";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PLAN_FACES, PLAN_FACE_LABEL, PlanFace, sentimentMouth, type PlanSentiment } from "./PlanFace";
import { PlanScreenHead } from "./PlanScreenHead";
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
            className="mt-2 block w-full resize-none rounded-xl border border-[var(--mp-line)] bg-[var(--mp-bg)] px-3 py-2.5 text-[14.5px] leading-[1.4] text-[var(--mp-tx)] outline-none placeholder:text-[#6F6A65] focus:border-[var(--mp-line-strong)] focus:bg-white"
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
export function PlanVisitsScreen({ onBack }: { onBack: () => void }) {
  const [visits, setVisits] = useState<PlanExperienceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
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
  for (const visit of visits ?? []) {
    const month = monthKey(visit.plannedDate);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(visit);
    else groups.push({ month, items: [visit] });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back="План" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        <h2 className="mb-1 text-[26px] font-bold leading-[1.1] tracking-[-.025em] text-[var(--mp-tx)]">
          Где мы уже{" "}
          <em className="font-display font-medium not-italic text-[var(--mp-ac)]" style={{ fontStyle: "italic" }}>были</em>
        </h2>

        {visits === null && !failed ? (
          <div className="mt-5 space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)]" />
            ))}
          </div>
        ) : failed ? (
          <div className="mt-5 rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15px] leading-6 text-[var(--mp-tx2)]">
            Не получилось загрузить визиты.{" "}
            <button type="button" onClick={() => setReloadKey((v) => v + 1)} className="font-bold text-[var(--mp-ac-dark)]">Попробовать снова</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15px] leading-6 text-[var(--mp-tx2)]">
            <b className="font-bold text-[var(--mp-tx)]">Пока пусто.</b> Здесь появятся события, на которых вы побывали.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.month}>
              <div className="mb-2.5 mt-5 text-[13px] font-bold text-[var(--mp-tx2)]">{group.month}</div>
              {group.items.map((visit) => (
                <div key={visit.id} className="mb-2 rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] px-3 pb-2 pt-3">
                  <div className="text-[15.5px] font-bold leading-[1.3] tracking-[-.005em] text-[var(--mp-tx)]">{visit.title}</div>
                  <div className="mt-0.5 text-[13px] text-[var(--mp-tx2)]">{dayLabel(visit.plannedDate)}</div>
                  {openId === visit.id ? (
                    <RateBox
                      initial={visit.feedbackSentiment}
                      initialComment={visit.feedbackComment ?? ""}
                      busy={busy}
                      onCancel={() => setOpenId(null)}
                      onSave={(s, c) => void rate(visit.id, s, c)}
                    />
                  ) : visit.feedbackSentiment ? (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between gap-2">
                        {/* Отправленный отзыв не редактируется: API отвечает 409 на изменённую оценку. */}
                        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--mp-tx)]">
                          <PlanFace mouth={sentimentMouth(visit.feedbackSentiment)} size={20} />
                          {PLAN_FACE_LABEL[visit.feedbackSentiment]}
                        </span>
                      </div>
                      {visit.feedbackComment ? (
                        <p className="mb-1 mt-0.5 text-[13.5px] italic leading-[1.45] text-[var(--mp-tx2)]">«{visit.feedbackComment}»</p>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenId(visit.id)}
                      className="mb-1 mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--mp-ac-soft)] px-3.5 text-[13.5px] font-bold text-[var(--mp-ac-dark)] transition-colors hover:bg-brand-soft-hover"
                    >
                      <PlanFace mouth="good" size={17} />
                      Как было? Оценить
                    </button>
                  )}
                </div>
              ))}
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
