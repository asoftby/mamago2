"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { activityTypeLabelRu } from "@/lib/activity/activityTypeLabelsRu";
import { Button } from "@/components/ui/button";

function formatIdeaMeta(idea: MyPlanIdea): string {
  const a = idea.activity;
  const parts: string[] = [];
  if (a.ageLabel?.trim()) parts.push(a.ageLabel.trim());
  const pt = a.priceText?.trim();
  if (pt) {
    parts.push(pt);
  } else if (a.priceFrom != null) {
    parts.push(
      a.priceFrom === 0
        ? "Бесплатно"
        : `от ${a.priceFrom}${a.currency ? ` ${a.currency}` : ""}`,
    );
  }
  const addr =
    a.place?.shortAddress?.trim() ||
    a.place?.formattedAddr?.trim() ||
    a.venue?.place?.shortAddress?.trim();
  if (addr) parts.push(addr);
  if (parts.length > 0) return parts.join(" · ");
  return a.eventCategory?.nameRu ?? "";
}

export type PlanIdeasBlockProps = {
  ideas: MyPlanIdea[];
  city: string;
  /** Пока грузим список из /api/save/ideas — компактный плейсхолдер под пустым днём */
  loading?: boolean;
  maxItems?: number;
  compact?: boolean;
  addingActivityId: string | null;
  removingActivityId: string | null;
  onAddToPlan: (idea: MyPlanIdea) => void | Promise<void>;
  onRemoveIdea: (activityId: string) => void | Promise<void>;
  onOpenActivity: (
    event: React.MouseEvent<HTMLAnchorElement>,
    activity: { id: string; slug?: string | null },
  ) => void;
  onAllIdeasClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function PlanIdeasBlock({
  ideas,
  city,
  loading = false,
  maxItems = 5,
  compact,
  addingActivityId,
  removingActivityId,
  onAddToPlan,
  onRemoveIdea,
  onOpenActivity,
  onAllIdeasClick,
}: PlanIdeasBlockProps) {
  const slice = ideas.slice(0, maxItems);

  if (loading && slice.length === 0) {
    return (
      <section
        className={cn(
          "rounded-xl border border-neutral-200/90 bg-white",
          compact ? "p-3" : "p-4 shadow-sm",
        )}
        aria-label="Сохранённые идеи"
        aria-busy="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900">Идеи</h3>
            <p className="mt-0.5 text-xs text-neutral-500 leading-snug">
              Загружаем сохранённое…
            </p>
          </div>
        </div>
        <div className={cn("mt-3 space-y-2", compact && "mt-2.5 space-y-1.5")}>
          <div className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-14 animate-pulse rounded-lg bg-neutral-100/90" />
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-neutral-200/90 bg-white",
        compact ? "p-3" : "p-4 shadow-sm",
      )}
      aria-label="Сохранённые идеи"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900">Идеи</h3>
          <p className="mt-0.5 text-xs text-neutral-500 leading-snug">
            Сохранённое, что можно добавить в этот день
          </p>
        </div>
        <Link
          href="/ideas"
          onClick={onAllIdeasClick}
          className="shrink-0 text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-800 hover:underline"
        >
          Все идеи
        </Link>
      </div>

      <ul className={cn("mt-3 space-y-2", compact && "mt-2.5 space-y-1.5")}>
        {slice.map((idea) => {
          const meta = formatIdeaMeta(idea);
          const typeLabel = activityTypeLabelRu(idea.activity.type);
          const busy = addingActivityId === idea.activityId;

          return (
            <li
              key={idea.id}
              className="flex items-start gap-2 rounded-lg border border-neutral-100 bg-neutral-50/60 px-2.5 py-2 sm:gap-3 sm:px-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={publicActivityPath(idea.activity.id, city, idea.activity.slug)}
                  className="line-clamp-2 text-left text-sm font-medium leading-tight text-neutral-900 hover:text-neutral-700"
                  onClick={(e) => onOpenActivity(e, idea.activity)}
                >
                  {idea.activity.title}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-500 sm:text-xs">
                  <span className="text-neutral-600">{typeLabel}</span>
                  {meta ? (
                    <>
                      <span className="text-neutral-300"> · </span>
                      {meta}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={idea.inPlanOnDate || busy}
                  className={cn(
                    "h-8 shrink-0 px-2.5 text-xs font-medium sm:h-9 sm:px-3",
                    idea.inPlanOnDate &&
                      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
                  )}
                  onClick={() => void onAddToPlan(idea)}
                >
                  {busy ? "…" : idea.inPlanOnDate ? "В плане" : "Добавить в план"}
                </Button>
                <button
                  type="button"
                  onClick={() => void onRemoveIdea(idea.activityId)}
                  disabled={removingActivityId === idea.activityId}
                  className="text-[11px] font-medium text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline disabled:opacity-50"
                >
                  Убрать
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
