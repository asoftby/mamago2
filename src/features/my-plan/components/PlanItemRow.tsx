"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, Trash2, Users } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import type { PlanItemWithActivity } from "../types/event";
import { resolvePlanItemCategory, type PlanItemCategoryKey } from "../lib/planItemCategory";
import { PlanItemCategoryPicker, PlanItemCategoryTile } from "./PlanItemCategoryIcon";

interface PlanItemRowProps {
  item: PlanItemWithActivity;
  /** Удаление с отложенным откатом (5 с, обратный отсчёт) — реализует родитель. */
  onRemove: () => void;
  /** Перенос на другую дату; не передан → кнопки «Перенести» нет (маршруты, места). */
  onMove?: () => void;
  /** Имя ребёнка, для кого пункт. Нет → «Вся семья». */
  participantLabel?: string | null;
}

export type PlanItemVisualKind = "event" | "note";

export function planItemVisualKind(
  item: Pick<PlanItemWithActivity, "source">,
): PlanItemVisualKind {
  return item.source === "MANUAL" || item.source === "TELEGRAM_FORWARD"
    ? "note"
    : "event";
}

const twoLineTitleStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
} as const;

function Avatar({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--mp-ac-soft)] text-[10px] font-bold leading-none text-[var(--mp-ac-dark)]"
    >
      {name ? name.trim().charAt(0).toUpperCase() : <Users className="h-2.5 w-2.5" />}
    </span>
  );
}

export function PlanItemRow({ item, onRemove, onMove, participantLabel }: PlanItemRowProps) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const activityDetailHref = item.activity?.id
    ? publicActivityPath(item.activity.id, city, item.activity.slug)
    : null;
  const title = item.title || item.activity?.title || "Запись";
  const isManual = item.source === "MANUAL";
  // Тап по карточке: событие mamaGo → его страница; свой пункт → страница плана на этот день.
  const openHref = activityDetailHref ?? (isManual ? `/me/plan?date=${item.date}` : null);

  const time = item.startsAt
    ? new Date(item.startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;

  const poster = item.activity?.coverImageUrl ?? item.coverImageUrl;
  const isCatalogEvent = planItemVisualKind(item) === "event";
  const [category, setCategory] = useState<PlanItemCategoryKey>(() =>
    resolvePlanItemCategory(item.category, title),
  );

  const showPoster = isCatalogEvent && Boolean(poster);
  const showReminder = Boolean(item.reminderEnabled && item.startsAt);

  const changeCategory = async (next: PlanItemCategoryKey) => {
    const previous = category;
    setCategory(next);
    if (!isManual || !item.updatedAt) return;
    try {
      const res = await fetch(`/api/plan/manual/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category: next,
          expectedUpdatedAt: new Date(item.updatedAt).toISOString(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      requestPlanRefetchForDate(item.date);
    } catch {
      setCategory(previous);
      toast.error("Не удалось изменить значок");
    }
  };

  const titleClassName = "text-[15.5px] font-semibold leading-[1.35] text-[var(--mp-tx)] [overflow-wrap:anywhere]";

  return (
    <article className="group relative rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] p-3 transition-colors hover:border-[var(--mp-line-strong)] focus-within:border-[var(--mp-line-strong)]">
      <div className="flex items-start gap-3">
        <div className="w-10 shrink-0 pt-0.5 text-center text-text-main">
          {time ? (
            <span className="text-[14px] font-bold leading-5 tabular-nums">{time}</span>
          ) : (
            <span className="block text-[11px] leading-[1.2] text-[var(--mp-tx2)]">Весь день</span>
          )}
        </div>

        {showPoster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster!}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : isCatalogEvent ? (
          <PlanItemCategoryTile category={category} />
        ) : !isManual ? (
          <PlanItemCategoryTile category={category} />
        ) : (
          <PlanItemCategoryPicker value={category} onChange={(next) => void changeCategory(next)} className="relative z-10" />
        )}

        <div className="min-w-0 flex-1">
          {openHref ? (
            <Link
              href={openHref}
              className={`${titleClassName} no-underline after:absolute after:inset-0 after:content-['']`}
              style={twoLineTitleStyle}
            >
              {title}
            </Link>
          ) : (
            <span className={titleClassName} style={twoLineTitleStyle}>
              {title}
            </span>
          )}

          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] leading-4 text-[var(--mp-tx2)]">
            <Avatar name={participantLabel ?? null} />
            <span className="min-w-0 truncate">{participantLabel || "Вся семья"}</span>
            {showReminder ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <span aria-hidden>·</span>
                <Bell className="h-3 w-3" aria-hidden />
                <span>Напоминание</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative z-10 -mr-1 flex shrink-0 items-center">
          {onMove ? (
            <button
              type="button"
              onClick={onMove}
              aria-label={`Перенести «${title}»`}
              title="Перенести"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mp-tx2)] outline-none transition-colors hover:bg-[var(--mp-soft)] hover:text-[var(--mp-tx)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <CalendarClock className="h-[18px] w-[18px]" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Убрать «${title}» из плана`}
            title="Удалить"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mp-tx2)] outline-none transition-colors hover:bg-danger-soft hover:text-danger focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Trash2 className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
