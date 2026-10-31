"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, Heart, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PLAN_FOCUS } from "./planChipStyles";
import type { PlanSuggestionItem } from "../../lib/fetchPlanSuggestions";

const ROUND =
  "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line)] bg-white text-[var(--mp-tx)] shadow-[0_4px_12px_-4px_rgba(20,18,16,.18)] transition-colors hover:bg-[var(--mp-bg)]";

export type PlanPicksPerson = { id: string; label: string };

/**
 * «Подборка для вас»: экран по кнопке «Подобрать, куда сходить». Карточки из /api/plan/suggestions,
 * «В план» ставит событие на выбранный день, сердечко сохраняет в «Мои идеи».
 */
export function PlanPicksScreen({
  title,
  people,
  selectedPeopleIds,
  onTogglePerson,
  suggestions,
  loading,
  failed,
  addingActivityId,
  metaFor,
  ageQuestion,
  exhausted,
  onAdd,
  onRetry,
  onMore,
  onOpenCatalog,
  onBack,
  onClose,
}: {
  /** «Куда сходить в среду, 4 ноября». */
  title: string;
  people: PlanPicksPerson[];
  selectedPeopleIds: string[];
  onTogglePerson: (id: string | null) => void;
  suggestions: PlanSuggestionItem[];
  loading: boolean;
  failed: boolean;
  addingActivityId: string | null;
  metaFor: (activity: PlanSuggestionItem) => string;
  /** Вопрос про возраст детей, если без него подборку не построить. */
  ageQuestion: ReactNode;
  exhausted: boolean;
  onAdd: (activity: PlanSuggestionItem) => void;
  onRetry: () => void;
  onMore: () => void;
  onOpenCatalog: () => void;
  onBack: () => void;
  onClose?: () => void;
}) {
  const [saved, setSaved] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const saveIdea = async (activity: PlanSuggestionItem) => {
    if (saved.includes(activity.id) || savingId) return;
    setSavingId(activity.id);
    try {
      const res = await fetch("/api/save/idea", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved((list) => [...list, activity.id]);
      toast.success("Сохранено в «Мои идеи»");
    } catch {
      toast.error("Не получилось сохранить");
    } finally {
      setSavingId(null);
    }
  };

  const chip = (selected: boolean) =>
    cn(
      "inline-flex h-[46px] shrink-0 items-center rounded-full border px-[18px] text-[15px] font-semibold transition-colors",
      selected
        ? "border-[var(--mp-chip-on-bg)] bg-[var(--mp-chip-on-bg)] text-[var(--mp-chip-on-tx)]"
        : "border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)] hover:border-[var(--mp-tx2)]",
      PLAN_FOCUS,
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <div className="flex shrink-0 items-start gap-3 px-5 pb-1.5 pt-[26px] md:px-8">
        <button type="button" onClick={onBack} aria-label="Назад в план" className={cn(ROUND, "mt-1", PLAN_FOCUS)}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mp-font-meta m-0 flex items-center gap-2 text-[12.5px] font-medium uppercase leading-none tracking-[.16em] text-[var(--mp-ac-dark)]">
            <i aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--mp-ac-dark)]" />
            Подборка для вас
          </p>
          <h2 className="m-0 mt-1.5 text-[27px] font-extrabold leading-[1.1] tracking-[-.025em] text-[var(--mp-tx)] [text-wrap:pretty]">{title}</h2>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Закрыть мой план" className={cn(ROUND, "mt-1", PLAN_FOCUS)}>
            <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-1 md:px-8">
        <p className="m-0 mx-0.5 mb-1 mt-1 text-[14.5px] leading-[1.5] text-[var(--mp-tx2)]">
          Учли возраст детей и выбранный день.
        </p>

        {people.length > 1 ? (
          <div role="group" aria-label="Для кого" className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:-mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
            <button type="button" aria-pressed={selectedPeopleIds.length === 0} onClick={() => onTogglePerson(null)} className={chip(selectedPeopleIds.length === 0)}>
              Для всех
            </button>
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                aria-pressed={selectedPeopleIds.includes(person.id)}
                onClick={() => onTogglePerson(person.id)}
                className={chip(selectedPeopleIds.includes(person.id))}
              >
                {person.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {ageQuestion ? (
            ageQuestion
          ) : loading ? (
            <div className="space-y-2.5" aria-busy>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[126px] animate-pulse rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)]" />
              ))}
            </div>
          ) : failed ? (
            <div className="rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15px] leading-6 text-[var(--mp-tx2)]">
              Не получилось загрузить подборку.{" "}
              <button type="button" onClick={onRetry} className="font-bold text-[var(--mp-ac-dark)] underline underline-offset-[3px]">
                Попробовать снова
              </button>
            </div>
          ) : suggestions.length === 0 ? (
            <p className="m-0 px-0.5 text-[15px] leading-6 text-[var(--mp-tx2)]">На эту дату подходящих событий пока нет.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {suggestions.map((activity) => {
                const meta = metaFor(activity);
                const category = activity.eventCategory?.nameRu;
                const isSaved = saved.includes(activity.id);
                return (
                  <article key={activity.id} className="flex items-start gap-3.5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-3">
                    <span className="flex h-[100px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--mp-soft)]">
                      {activity.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activity.coverImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="m-0 line-clamp-2 text-[17px] font-bold leading-[1.25] tracking-[-.01em] text-[var(--mp-tx)] [overflow-wrap:anywhere]">
                        {activity.title}
                      </h3>
                      {category ? <p className="m-0 mt-1 truncate text-[13.5px] text-[var(--mp-tx2)]">{category}</p> : null}
                      {meta ? <p className="mp-font-meta m-0 mt-0.5 truncate text-[12px] tracking-[.02em] text-[var(--mp-tx2)]">{meta}</p> : null}
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={addingActivityId === activity.id}
                          onClick={() => onAdd(activity)}
                          className="h-11 rounded-full bg-[var(--mp-tx)] px-[18px] text-[14.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          В план
                        </button>
                        <button
                          type="button"
                          aria-label={isSaved ? "Сохранено в идеи" : "Сохранить в идеи"}
                          aria-pressed={isSaved}
                          disabled={savingId === activity.id}
                          onClick={() => void saveIdea(activity)}
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-full bg-[var(--mp-ac-soft)] text-[var(--mp-ac-dark)] transition-colors hover:bg-brand-soft-hover disabled:opacity-60",
                            PLAN_FOCUS,
                          )}
                        >
                          <Heart className="h-[18px] w-[18px]" strokeWidth={2} fill={isSaved ? "currentColor" : "none"} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {!ageQuestion && !loading && !failed ? (
          <button
            type="button"
            onClick={exhausted ? onOpenCatalog : onMore}
            className="mx-auto mt-[22px] block min-h-11 px-3 text-center text-[14px] font-medium text-[var(--mp-tx2)] hover:text-[var(--mp-tx)]"
          >
            {exhausted ? "Открыть каталог →" : "Подобрать ещё →"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
