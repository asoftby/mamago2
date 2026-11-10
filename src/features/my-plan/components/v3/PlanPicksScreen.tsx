"use client";

import { useState, type ReactNode } from "react";
import { RefreshCw, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PLAN_FOCUS } from "./planChipStyles";
import { PlanScreenHeader } from "./PlanScreenHeader";
import { PlanPickCard } from "../PlanPickCard";
import { formatActivityAddressLine } from "../../lib/formatActivityAddress";
import type { PlanSuggestionItem } from "../../lib/fetchPlanSuggestions";

export type PlanPicksPerson = { id: string; label: string };
export type PlanPicksAge = { value: string; label: string };

/**
 * «Подборка для вас»: экран по кнопке «Подобрать, куда сходить». Карточки из /api/plan/suggestions,
 * «В план» ставит событие на выбранный день, сердечко сохраняет в «Мои идеи».
 */
export function PlanPicksScreen({
  title,
  meta,
  people,
  selectedPeopleIds,
  onTogglePerson,
  ageOptions,
  selectedAges,
  onToggleAge,
  onResetAges,
  suggestions,
  loading,
  failed,
  addingActivityId,
  metaFor,
  ageQuestion,
  exhausted,
  canGoPrevious = false,
  onAdd,
  onRetry,
  onMore,
  onPrevious,
  onOpenCatalog,
  onBack,
  onClose,
}: {
  /** «Куда сходить в среду, 4 ноября». */
  title: string;
  /** «Воскресенье, 1 ноября»: день недели и дата выбранного дня. */
  meta?: string;
  people: PlanPicksPerson[];
  selectedPeopleIds: string[];
  onTogglePerson: (id: string | null) => void;
  /** Возрастные диапазоны для своего поиска; «Для всех» = возраст «Любой». */
  ageOptions: PlanPicksAge[];
  selectedAges: string[];
  onToggleAge: (value: string) => void;
  onResetAges: () => void;
  suggestions: PlanSuggestionItem[];
  loading: boolean;
  failed: boolean;
  addingActivityId: string | null;
  metaFor: (activity: PlanSuggestionItem) => { date?: string | null; time?: string | null; price?: string | null };
  /** Вопрос про возраст детей, если без него подборку не построить. */
  ageQuestion: ReactNode;
  exhausted: boolean;
  canGoPrevious?: boolean;
  onAdd: (activity: PlanSuggestionItem) => void;
  onRetry: () => void;
  onMore: () => void;
  onPrevious?: () => void;
  onOpenCatalog: () => void;
  onBack: () => void;
  onClose?: () => void;
}) {
  const [saved, setSaved] = useState<string[]>([]);
  /** «Для всех» = возраст «Любой»: ни людей, ни возраста не выбрано. */
  const anyAge = selectedPeopleIds.length === 0 && selectedAges.length === 0;
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
      "inline-flex h-[46px] shrink-0 items-center rounded-full border px-[18px] text-[14px] font-semibold transition-colors",
      selected
        ? "border-[var(--mp-chip-on-line)] bg-[var(--mp-chip-on-bg)] text-[var(--mp-chip-on-tx)]"
        : "border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)] hover:border-[var(--mp-tx2)]",
      PLAN_FOCUS,
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHeader kicker="Подборка для вас" title={title} meta={meta} onBack={onBack} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-0 md:px-8">
        <div role="group" aria-label="Для кого" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:-mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {selectedAges.length > 0 ? (
            <span className={cn(chip(true), "gap-1.5 pr-2")}>
              <span className="whitespace-nowrap">
                {ageOptions.find((age) => age.value === selectedAges[0])?.label ?? selectedAges[0]}
                {selectedAges.length > 1 ? ` +${selectedAges.length - 1}` : ""}
              </span>
              <button
                type="button"
                aria-label="Сбросить возраст"
                onClick={onResetAges}
                className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-black/10 hover:bg-black/15", PLAN_FOCUS)}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              </button>
            </span>
          ) : null}
          <button type="button" aria-pressed={anyAge} onClick={() => onTogglePerson(null)} className={chip(anyAge)}>
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
        <div role="group" aria-label="Возраст" className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:-mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            aria-pressed={anyAge}
            onClick={() => onTogglePerson(null)}
            className={chip(anyAge)}
          >
            Любой
          </button>
          {ageOptions.map((age) => (
            <button
              key={age.value}
              type="button"
              aria-pressed={selectedAges.includes(age.value)}
              onClick={() => onToggleAge(age.value)}
              className={chip(selectedAges.includes(age.value))}
            >
              {age.label}
            </button>
          ))}
        </div>

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
            <p role="status" className="m-0 flex min-h-[76px] items-center justify-center rounded-[22px] border border-[#d6e4f3] bg-[#eaf2fb] px-4 py-3 text-center text-[14px] leading-[1.5] text-[var(--mp-tx2)]">На эту дату подходящих событий пока нет.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {suggestions.map((activity) => {
                const isSaved = saved.includes(activity.id);
                const fields = metaFor(activity);
                return (
                  <PlanPickCard
                    key={activity.id}
                    title={activity.title}
                    coverImageUrl={activity.coverImageUrl}
                    address={formatActivityAddressLine(activity)}
                    date={fields.date}
                    time={fields.time}
                    price={fields.price}
                    adding={addingActivityId === activity.id}
                    onAdd={() => onAdd(activity)}
                    isSaved={isSaved}
                    saving={savingId === activity.id}
                    onSave={() => void saveIdea(activity)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {!ageQuestion && !loading && !failed && suggestions.length > 0 ? (
          <div className="mt-[22px] flex flex-col items-center gap-1">
            {canGoPrevious && onPrevious ? (
              <button
                type="button"
                onClick={onPrevious}
                className={cn("flex min-h-11 items-center gap-2 px-3 text-center text-[14px] font-medium text-[var(--mp-tx2)] hover:text-[var(--mp-tx)]", PLAN_FOCUS)}
              >
                К прошлым вариантам
              </button>
            ) : null}
            <button
              type="button"
              onClick={exhausted ? onOpenCatalog : onMore}
              className={cn("flex min-h-11 items-center gap-2 px-3 text-center text-[14px] font-medium text-[var(--mp-tx2)] hover:text-[var(--mp-tx)]", PLAN_FOCUS)}
            >
              {exhausted ? "Открыть каталог →" : (
                <>
                  <RefreshCw className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  Показать ещё
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
