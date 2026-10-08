"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, EllipsisVertical, Users } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import type { PlanItemWithActivity } from "../types/event";
import { resolvePlanItemCategory, type PlanItemCategoryKey } from "../lib/planItemCategory";
import { PlanItemCategoryPicker, PlanItemCategoryTile } from "./PlanItemCategoryIcon";

interface PlanItemRowProps {
  item: PlanItemWithActivity;
  onRemove: () => void;
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
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-medium leading-none text-brand-active"
    >
      {name ? name.trim().charAt(0).toUpperCase() : <Users className="h-2.5 w-2.5" />}
    </span>
  );
}

export function PlanItemRow({ item, onRemove, participantLabel }: PlanItemRowProps) {
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  const titleClassName = "text-[15px] font-medium leading-[1.3] text-text-main [overflow-wrap:anywhere]";

  return (
    <article className="group relative rounded-[18px] border border-border bg-brand-muted p-3 transition-colors hover:border-border-hover focus-within:border-border-hover">
      <div className="flex items-start gap-3">
        <div className="w-10 shrink-0 pt-0.5 text-center text-text-main">
          {time ? (
            <span className="font-mono text-[13px] leading-5">{time}</span>
          ) : (
            <span className="block text-[11px] leading-[1.2] text-text-muted">Весь день</span>
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

          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-text-muted">
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

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Действия: «${title}»`}
              className="relative z-10 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted outline-none hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <EllipsisVertical className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 bg-white p-1">
            {openHref ? (
              <Link
                href={openHref}
                className="flex min-h-10 items-center rounded-md px-3 text-sm text-text-main no-underline hover:bg-surface-hover"
              >
                Открыть
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRemove();
              }}
              aria-label={`Убрать «${title}» из плана`}
              className="flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm text-danger hover:bg-danger-soft"
            >
              Убрать из плана
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </article>
  );
}
