"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { activityTypeLabelRu } from "@/lib/activity/activityTypeLabelsRu";
import type { PlanItemWithActivity } from "../types/event";
import { formatActivityAddressLine } from "../lib/formatActivityAddress";
import { MY_PLAN_FULL_PAGE_HREF, upcomingPlanItemHref } from "../lib/upcomingPlanItems";

function typeLabel(item: PlanItemWithActivity): string {
  if (item.activity) return activityTypeLabelRu(item.activity.type);
  if (item.planRouteSlug || item.routeId) return "Маршрут";
  if (item.planPlaceSlug || item.placeId) return "Место";
  return "Активность";
}

function dateTimeLabel(item: PlanItemWithActivity): string {
  const date = new Date(`${item.date}T12:00:00`);
  const day = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  if (!item.startsAt) return day;
  const time = new Date(item.startsAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

export function UpcomingPlanBlock({
  items,
  totalCount,
  onNavigate,
}: {
  items: PlanItemWithActivity[];
  totalCount: number;
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-plan-title" className="space-y-2">
      <h2 id="upcoming-plan-title" className="text-sm font-semibold text-neutral-900">
        Ближайшие активности
      </h2>
      <div className="space-y-2">
        {items.map((item) => {
          const href = upcomingPlanItemHref(item);
          const title = item.activity?.title ?? item.title ?? "Активность";
          const place = formatActivityAddressLine(item.activity);
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                  {typeLabel(item)}
                </p>
                <p className="truncate text-sm font-semibold text-neutral-900">{title}</p>
                <p className="truncate text-xs text-neutral-600">
                  {[dateTimeLabel(item), place].filter(Boolean).join(" · ")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
            </>
          );
          return href ? (
            <Link
              key={item.id}
              href={href}
              onClick={onNavigate}
              aria-label={`Открыть активность «${title}»`}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {content}
            </Link>
          ) : (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5">
              {content}
            </div>
          );
        })}
      </div>
      {totalCount > 2 ? (
        <Link
          href={MY_PLAN_FULL_PAGE_HREF}
          onClick={onNavigate}
          aria-label={`Показать все ${totalCount} активностей в Моём плане`}
          className="inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Показать все {totalCount} активностей
        </Link>
      ) : null}
    </section>
  );
}
