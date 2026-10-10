"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
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
  const ariaLabel = loading ? "Мой план" : model.ariaLabel;

  const capsuleClassName = cn(
    "pointer-events-auto flex h-14 min-w-0 items-center gap-3 rounded-[28px] pl-2 pr-4 text-left no-underline",
    "touch-manipulation outline-none transition-colors bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
    "focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );

  const capsuleContent = (
    <>
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white lg:bg-brand-soft/65 lg:text-primary" aria-hidden>
            <CalendarDays className="h-[19px] w-[19px]" strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <span className="block text-[12px] leading-tight text-white/90 lg:text-text-main">
              Мой <em className="font-display italic text-white lg:text-primary">план</em>
            </span>
            <span className="block text-[13px] font-medium leading-[1.2] text-white lg:text-text-main lg:line-clamp-2">
              {loading ? "Загружаем…" : "Добавим что-нибудь?"}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-white/85 lg:text-text-main/65" aria-hidden />
        </>
      )}
    </>
  );

  if (openInOverlay) {
    return (
      <button
        type="button"
        onClick={requestOpenMyPlan}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        data-my-plan-capsule
        data-state={loading ? "loading" : model.kind}
        className={capsuleClassName}
      >
        {capsuleContent}
      </button>
    );
  }

  return (
    <Link
      href={MY_PLAN_FULL_PAGE_HREF}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-my-plan-capsule
      data-state={loading ? "loading" : model.kind}
      className={capsuleClassName}
    >
      {capsuleContent}
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
