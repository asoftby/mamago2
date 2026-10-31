"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, Trash2 } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import { planEntryDisplay } from "../lib/planEntryDisplay";
import type { PlanItemWithActivity } from "../types/event";
import { resolvePlanItemCategory, type PlanItemCategoryKey } from "../lib/planItemCategory";
import { PlanItemCategoryPicker, PlanItemCategoryTile } from "./PlanItemCategoryIcon";

interface PlanItemRowProps {
  item: PlanItemWithActivity;
  /** Удаление с отложенным откатом (5 с, обратный отсчёт) — реализует родитель. */
  onRemove: () => void;
  /** Перенос на другую дату; не передан → кнопки «Перенести» нет (маршруты, места). */
  onMove?: () => void;
  /** Открыть событие внутри модалки плана (слайд); не передан → ссылка на страницу события. */
  onOpen?: () => void;
  /** Имя ребёнка, для кого пункт. Нет → «Вся семья». */
  participantLabel?: string | null;
  /** Creator of a shared entry, distinct from its assigned participant. */
  authorLabel?: string | null;
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

export function PlanItemRow({ item, onRemove, onMove, onOpen, participantLabel, authorLabel }: PlanItemRowProps) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const activityDetailHref = item.activity?.id
    ? publicActivityPath(item.activity.id, city, item.activity.slug)
    : null;
  const { title, poster, time } = planEntryDisplay(item);
  const isManual = item.source === "MANUAL";
  // Тап по карточке: событие mamaGo → его страница; свой пункт → страница плана на этот день.
  const openHref = activityDetailHref ?? (isManual ? `/me/plan?date=${item.date}` : null);

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

  const titleClassName = "text-[15px] font-semibold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)] [overflow-wrap:anywhere]";

  return (
    <article className="group relative rounded-[22px] border border-[#d6e4f3] bg-[#eaf2fb] py-3 pl-3.5 pr-2 transition-colors hover:border-[#b9cfe8] focus-within:border-[#b9cfe8]">
      <div className="flex items-start gap-3.5">

        {showPoster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster!}
            alt=""
            className="h-[50px] w-[50px] shrink-0 rounded-full border border-[#cbdcef] object-cover"
          />
        ) : isCatalogEvent ? (
          <PlanItemCategoryTile category={category} round />
        ) : !isManual ? (
          <PlanItemCategoryTile category={category} round />
        ) : (
          <PlanItemCategoryPicker round value={category} onChange={(next) => void changeCategory(next)} className="relative z-10" />
        )}

        <div className="min-w-0 flex-1">
          {onOpen && (item.activity || item.articleId || isManual) ? (
            <button
              type="button"
              onClick={onOpen}
              className={`${titleClassName} text-left after:absolute after:inset-0 after:content-['']`}
              style={twoLineTitleStyle}
            >
              {title}
            </button>
          ) : openHref ? (
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

          <div className="mp-font-meta mt-[3px] flex min-w-0 items-center gap-1.5 text-[11px] leading-4 tracking-[.02em] text-[var(--mp-tx2)]">
            <span className="shrink-0 tabular-nums">{time || "Весь день"}</span>
            <span aria-hidden>·</span>
            <span className="min-w-0 truncate">{participantLabel || "Вся семья"}</span>
            {authorLabel ? (
              <span className="min-w-0 truncate">· Добавил(а) {authorLabel}</span>
            ) : null}
            {showReminder ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <span aria-hidden>·</span>
                <Bell className="h-3 w-3" aria-hidden />
                <span>Напоминание</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 items-center self-center">
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
