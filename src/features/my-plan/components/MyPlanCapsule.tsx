"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyPlan } from "../hooks/useMyPlan";
import {
  buildPlanCapsuleModel,
  type PlanCapsuleDateBubble,
  type PlanCapsuleModel,
} from "../lib/planCapsule";
import { MY_PLAN_FULL_PAGE_HREF } from "../lib/upcomingPlanItems";
import { requestOpenMyPlan } from "@/lib/my-plan/myPlanOpenIntent";

function DateBubble({ bubble, className }: { bubble: PlanCapsuleDateBubble; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full leading-none",
        className,
      )}
    >
      <span className="text-[10px] leading-none">{bubble.weekday}</span>
      <span className="mt-0.5 text-[16px] font-medium leading-none">{bubble.day}</span>
    </span>
  );
}

/**
 * Вью капсулы «Мой план»: единая ссылка на страницу плана во всех состояниях.
 * Высота фиксирована (56px); цвета — только токены бренда.
 */
export function MyPlanCapsuleView({
  model,
  loading = false,
  className,
  openInOverlay = false,
}: {
  model: PlanCapsuleModel;
  loading?: boolean;
  className?: string;
  openInOverlay?: boolean;
}) {
  const isEmpty = model.kind === "empty";
  const ariaLabel = loading ? "Мой план" : model.ariaLabel;

  return (
    <Link
      href={MY_PLAN_FULL_PAGE_HREF}
      role={openInOverlay ? "button" : undefined}
      aria-haspopup={openInOverlay ? "dialog" : undefined}
      onClick={openInOverlay ? (event) => { event.preventDefault(); requestOpenMyPlan(); } : undefined}
      onKeyDown={openInOverlay ? (event) => {
        if (event.key === " ") {
          event.preventDefault();
          requestOpenMyPlan();
        }
      } : undefined}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-my-plan-capsule
      data-state={loading ? "loading" : model.kind}
      className={cn(
        "pointer-events-auto flex h-14 min-w-0 items-center gap-3 rounded-[28px] pl-2 text-left no-underline",
        "touch-manipulation outline-none transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isEmpty || loading
          ? "border border-brand/30 bg-surface pr-4"
          : "bg-brand pr-4 text-white hover:bg-brand-hover active:bg-brand-active",
        className,
      )}
    >
      {model.kind === "events" && !loading ? (
        <>
          {model.stackedNext ? (
            <span className="relative h-10 w-[52px] shrink-0" aria-hidden>
              <DateBubble
                bubble={model.stackedNext}
                className="absolute left-3 top-0 bg-brand-soft text-brand-active"
              />
              <DateBubble
                bubble={model.bubble}
                className="absolute left-0 top-0 z-10 bg-white text-brand-active ring-2 ring-brand"
              />
            </span>
          ) : (
            <span className="relative shrink-0" aria-hidden>
              <DateBubble bubble={model.bubble} className="bg-white text-brand-active" />
              {model.badgeCount ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-active px-1 text-[11px] font-medium leading-none text-white ring-2 ring-brand">
                  {model.badgeCount > 9 ? "9+" : model.badgeCount}
                </span>
              ) : null}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <span className="block truncate text-[12px] leading-tight text-white/85">{model.caption}</span>
            <span className="block truncate text-[15px] font-medium leading-tight not-italic">{model.title}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-white" aria-hidden />
        </>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <span className="block truncate text-[12px] leading-tight text-brand-active">
              Мой <em className="font-display italic text-primary">план</em>
            </span>
            <span className="block truncate text-[15px] font-medium leading-tight text-text-main">
              {loading ? "Загружаем…" : "Добавить интересненькое..."}
            </span>
          </span>
        </>
      )}
    </Link>
  );
}

/** Капсула с данными плана; пересчитывается при возврате на вкладку/в окно, без поллинга. */
export function MyPlanCapsule({ className, openInOverlay = false }: { className?: string; openInOverlay?: boolean }) {
  const {
    planSummary,
    planSummaryLoading,
    authLoading,
    isLoading,
    isAuthenticated,
    todayIso,
    refetchPlanSummary,
  } = useMyPlan();

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      setNow(new Date());
      void refetchPlanSummary();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isAuthenticated, refetchPlanSummary]);

  const loading = authLoading || isLoading || (isAuthenticated && planSummaryLoading && !planSummary);

  const model = useMemo(
    () =>
      buildPlanCapsuleModel({
        nearestItems: isAuthenticated
          ? (planSummary?.nearestItems ?? []).map((item) => ({
              date: item.date,
              startsAt: item.startsAt,
              title: item.title,
              activityTitle: item.activity?.title ?? null,
            }))
          : [],
        countsByDate: isAuthenticated ? (planSummary?.countsByDate ?? {}) : {},
        todayIso,
        now,
      }),
    [isAuthenticated, now, planSummary, todayIso],
  );

  return <MyPlanCapsuleView model={model} loading={loading} className={className} openInOverlay={openInOverlay} />;
}
