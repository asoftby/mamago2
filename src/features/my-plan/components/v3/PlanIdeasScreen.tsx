"use client";

import { Heart } from "lucide-react";
import type { MyPlanIdea } from "../../hooks/useMyPlan";
import { PlanScreenHeader } from "./PlanScreenHeader";

function ideasLabel(n: number): string {
  const m = n % 10;
  const h = n % 100;
  const word = m === 1 && h !== 11 ? "идея" : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? "идеи" : "идей";
  return `${n} ${word}`;
}

/**
 * «Мои идеи» внутри модалки: сохранённое без даты. «В план» ставит идею на выбранный в плане день
 * (тот же механизм, что у «Запланировать» в пустом дне).
 */
export function PlanIdeasScreen({
  ideas,
  dayLabel,
  plannedActivityIds,
  addingActivityId,
  onAdd,
  onOpenAll,
  onBack,
  onClose,
}: {
  ideas: MyPlanIdea[];
  /** «31 октября» — день, на который идея попадёт по «В план». */
  dayLabel: string;
  plannedActivityIds: ReadonlySet<string>;
  addingActivityId: string | null;
  onAdd: (idea: MyPlanIdea) => void;
  onOpenAll: () => void;
  onBack: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHeader title={ideas.length ? ideasLabel(ideas.length) : "Идей нет"} kicker="Мои идеи" onBack={onBack} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-0 md:px-8">
        <p className="m-0 mx-0.5 mb-1 mt-0.5 text-[14.5px] leading-[1.5] text-[var(--mp-tx2)]">
          Сохранено без даты. Нажмите «В план» — идея станет делом на {dayLabel}.
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          {ideas.map((idea) => {
            const poster = idea.activity.coverImageUrl;
            const planned = plannedActivityIds.has(idea.activityId);
            return (
              <div key={idea.id} className="flex items-center gap-3.5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-2.5">
                <span className="flex h-[70px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--mp-soft)] text-[var(--mp-tx2)]">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Heart className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[15px] font-semibold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)] [overflow-wrap:anywhere]">
                    {idea.activity.title}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={planned || addingActivityId === idea.activityId}
                  onClick={() => onAdd(idea)}
                  className="h-10 shrink-0 rounded-full bg-[var(--mp-tx)] px-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45"
                >
                  {planned ? "В плане" : "В план"}
                </button>
              </div>
            );
          })}
        </div>
        {ideas.length === 0 ? (
          <p className="m-0 mx-0.5 mt-4 text-[14.5px] leading-[1.5] text-[var(--mp-tx2)]">Сохраняйте места и события — они появятся здесь.</p>
        ) : null}
        <button
          type="button"
          onClick={onOpenAll}
          className="mx-auto mt-[22px] block min-h-11 px-3 text-center text-[13.5px] font-medium text-[var(--mp-tx2)] hover:text-[var(--mp-tx)]"
        >
          Все идеи на странице →
        </button>
      </div>
    </div>
  );
}
