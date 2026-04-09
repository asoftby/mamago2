"use client";

import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { activityTypeLabelRu } from "@/lib/activity/activityTypeLabelsRu";
import { isPlanSuggestionMockId } from "../lib/mockPlanSuggestions";

type Activity = NonNullable<MyPlanIdea["activity"]>;

function formatRecMeta(activity: Activity): string {
  const parts: string[] = [];
  if (activity.ageLabel?.trim()) parts.push(activity.ageLabel.trim());
  const pt = activity.priceText?.trim();
  if (pt) {
    parts.push(pt);
  } else if (activity.priceFrom != null) {
    parts.push(
      activity.priceFrom === 0
        ? "Бесплатно"
        : `от ${activity.priceFrom}${activity.currency ? ` ${activity.currency}` : ""}`,
    );
  }
  const addr =
    activity.place?.shortAddress?.trim() ||
    activity.place?.formattedAddr?.trim() ||
    activity.venue?.place?.shortAddress?.trim();
  if (addr) parts.push(addr);
  if (parts.length > 0) return parts.join(" · ");
  return activity.eventCategory?.nameRu ?? "";
}

export type PlanRecommendationsBlockProps = {
  heading: string;
  /** Подзаголовок под персональным заголовком */
  subtitle: string;
  activities: Activity[];
  city: string;
  loading?: boolean;
  maxItems?: number;
  compact?: boolean;
  addingActivityId: string | null;
  /** activity.id уже в плане на выбранную дату → кнопка «Добавлено» (из planItemsByDate) */
  inPlanActivityIds: ReadonlySet<string>;
  onAddToPlan: (activity: Activity) => void | Promise<void>;
  onOpenActivity: (
    event: React.MouseEvent<HTMLAnchorElement>,
    activity: { id: string; slug?: string | null },
  ) => void;
  /** Каталог для ссылок-примеров (моки) */
  seeMoreHref: string;
};

export function PlanRecommendationsBlock({
  heading,
  subtitle,
  activities,
  city,
  loading,
  maxItems = 5,
  compact,
  addingActivityId,
  inPlanActivityIds,
  onAddToPlan,
  onOpenActivity,
  seeMoreHref,
}: PlanRecommendationsBlockProps) {
  const slice = activities.slice(0, maxItems);
  /** Не подменяем список на «Подбираем…», если уже есть строки — иначе скачок при смене чипов. */
  const showLoadingOnly = Boolean(loading && slice.length === 0);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] bg-[#FFF5F0]",
        "shadow-[0_1px_0_rgba(239,135,89,0.08),0_8px_32px_-8px_rgba(239,135,89,0.12)]",
      )}
    >
      {/* Вращающийся conic-gradient: «бегущий» блик по контуру (кольцо 2px под белой карточкой) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[1.75rem]"
        aria-hidden
      >
        <div
          className="animate-mg-plan-ai-border-spin absolute left-1/2 top-1/2 aspect-square w-[240%] max-w-none sm:w-[220%]"
          style={{
            background:
              "conic-gradient(from 0deg, #FFF8F4 0deg, #FFE8DC 36deg, rgba(239,135,89,0.42) 72deg, #FFEFE6 108deg, #FFD4C4 162deg, rgba(255,200,180,0.5) 216deg, #FFF5F0 270deg, #FFE4D4 306deg, #FFF8F4 360deg)",
          }}
        />
      </div>
      <section
        className={cn(
          "relative z-[1] m-[2px] rounded-[calc(1.75rem-4px)] border border-white/80 bg-white",
          compact ? "p-3" : "p-4 sm:p-5",
        )}
        aria-label={heading}
      >
        <div
          className={cn(
            "relative flex flex-col gap-0 pr-8 sm:pr-9",
            compact && "pr-7 sm:pr-8",
          )}
        >
          <div className="absolute right-0 top-0 flex justify-end">
            <span
              className="inline-flex text-primary/70"
              aria-label="Подборка с помощью AI"
            >
              <Sparkles
                className="h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]"
                strokeWidth={1.5}
                aria-hidden
              />
            </span>
          </div>
          <h3 className="min-h-0 font-semibold leading-snug text-neutral-900">
            {heading}
          </h3>
          <p className="text-xs leading-snug text-neutral-500 sm:text-[13px]">{subtitle}</p>
        </div>

        {showLoadingOnly ? (
          <p className={cn("mt-3 text-sm text-neutral-400", compact && "mt-2.5")}>
            Подбираем варианты…
          </p>
        ) : slice.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            Пока пусто — откройте каталог ниже.
          </p>
        ) : (
          <ul
            className={cn(
              "mt-3 space-y-2",
              compact && "mt-2.5 space-y-1.5",
              loading && "opacity-80 transition-opacity",
            )}
          >
            {slice.map((activity) => {
              const meta = formatRecMeta(activity);
              const typeLabel = activityTypeLabelRu(activity.type);
              const busy = addingActivityId === activity.id;
              const isMock = isPlanSuggestionMockId(activity.id);
              const inPlan = inPlanActivityIds.has(activity.id);

              return (
                <li
                  key={activity.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 sm:gap-3 sm:px-3",
                    isMock
                      ? "border-dashed border-neutral-200/90 bg-neutral-50/50"
                      : "border-neutral-100/90 bg-neutral-50/60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={
                        isMock
                          ? seeMoreHref
                          : publicActivityPath(activity.id, city, activity.slug)
                      }
                      className="line-clamp-2 text-left text-sm font-medium leading-tight text-neutral-900 hover:text-neutral-700"
                      onClick={(e) => onOpenActivity(e, activity)}
                    >
                      {isMock ? (
                        <span className="mr-1.5 inline-block rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                          Пример
                        </span>
                      ) : null}
                      {activity.title}
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
                  {inPlan ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled
                      aria-label="Событие уже в плане на этот день"
                      className={cn(
                        "inline-flex h-8 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border px-2.5 text-[11px] font-semibold leading-snug sm:h-9 sm:px-3 sm:text-xs",
                        "border-emerald-200/90 bg-emerald-50/95 text-emerald-900",
                      )}
                    >
                      Добавлено
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className={cn(
                        "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold leading-snug text-white shadow-sm transition-colors",
                        "bg-neutral-900 hover:bg-neutral-800",
                        "disabled:pointer-events-none disabled:opacity-50",
                      )}
                      onClick={() => void onAddToPlan(activity)}
                    >
                      <Plus
                        className="h-3 w-3 shrink-0 stroke-[2.5]"
                        aria-hidden
                      />
                      {busy ? "Добавляем..." : "Добавить в план"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {loading && slice.length > 0 ? (
          <p className="sr-only" aria-live="polite">
            Обновляем подборку
          </p>
        ) : null}
      </section>
    </div>
  );
}
