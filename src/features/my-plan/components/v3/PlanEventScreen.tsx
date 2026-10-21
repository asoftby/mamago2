"use client";

import Link from "next/link";
import { CalendarClock, CalendarDays, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import { planEntryDisplay } from "../../lib/planEntryDisplay";
import { formatPlanCardPrice } from "../../lib/planPagePresentation";
import { resolveActivityAddress } from "../../lib/formatActivityAddress";
import type { PlanItemWithActivity } from "../../types/event";
import { PlanScreenHead } from "./PlanScreenHead";

function formatEventDate(dateISO: string): string {
  const label = new Date(`${dateISO}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Экран события внутри модалки «Мой план»: фото, где и когда, главная кнопка
 * (билет / запись), «Перенести» и «Удалить из плана». Выезжает справа, как «Новое дело».
 */
export function PlanEventScreen({
  item,
  onBack,
  onRemove,
  onMove,
  onNavigate,
}: {
  item: PlanItemWithActivity;
  onBack: () => void;
  onRemove: () => void;
  /** Нет → кнопки «Перенести» нет (для события без возможности переноса). */
  onMove?: () => void;
  /** Вызывается перед внутренним переходом по ссылке — закрыть модалку плана. */
  onNavigate?: () => void;
}) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const activity = item.activity;
  const { title, poster, time } = planEntryDisplay(item);
  const address = resolveActivityAddress(activity);
  const placeTitle = activity?.place?.title?.trim() || activity?.venue?.title?.trim() || null;
  const street = [address.streetAddressLabel, address.metroLabel].filter(Boolean).join(" · ");
  const detailHref = activity ? publicActivityPath(activity.id, city, activity.slug) : null;
  const cta = activity ? resolveActivityParticipationCta(activity, city) : null;
  const ctaHref = cta?.href ?? detailHref;
  const price = activity ? formatPlanCardPrice(activity) : null;
  const isClass = activity?.type === "COURSE";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back="План" onBack={onBack} />
      <span className={`mx-5 mb-3 inline-flex h-[30px] w-fit items-center rounded-full px-3 text-[13px] font-bold md:mx-8 ${isClass ? "bg-[#E4E6F4] text-[#454C86]" : "bg-[var(--mp-ac-soft)] text-[var(--mp-ac-dark)]"}`}>
        {isClass ? "Занятие" : "Из афиши"}
      </span>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-[var(--mp-soft)]">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="mt-[18px] flex items-start gap-3">
          <h2 className="mp-font-display m-0 flex-1 text-[26px] font-normal leading-[1.18] tracking-[-0.015em] text-[var(--mp-tx)] [text-wrap:pretty]">
            {title}
          </h2>
          {activity?.ageLabel ? (
            <span className="mt-[3px] inline-flex h-[30px] shrink-0 items-center rounded-[9px] border-[1.5px] border-[var(--mp-tx)] px-[11px] text-sm font-extrabold text-[var(--mp-tx)]">
              {activity.ageLabel}
            </span>
          ) : null}
        </div>

        <div className="mx-0.5 mt-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-3 text-[15.5px] leading-[1.35]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx2)]">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <b className="block font-bold text-[var(--mp-tx)]">
                {formatEventDate(item.date)}
                {time ? ` · ${time}` : ""}
              </b>
              {activity?.eventCategory?.nameRu ? (
                <span className="mt-0.5 block text-[13.5px] text-[var(--mp-tx2)]">{activity.eventCategory.nameRu}</span>
              ) : null}
            </span>
          </div>
          {placeTitle || street ? (
            <div className="flex items-start gap-3 text-[15.5px] leading-[1.35]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx2)]">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                {placeTitle ? <b className="block font-bold text-[var(--mp-tx)]">{placeTitle}</b> : null}
                {street ? <span className="mt-0.5 block text-[13.5px] text-[var(--mp-tx2)]">{street}</span> : null}
              </span>
            </div>
          ) : null}
        </div>

        {detailHref ? (
          <Link
            href={detailHref}
            onClick={onNavigate}
            className="mx-auto mt-3.5 flex min-h-11 w-fit items-center gap-2 rounded-xl px-2.5 text-[15.5px] font-bold text-[var(--mp-ac-dark)] no-underline transition-colors hover:text-[var(--mp-ac)]"
          >
            <ExternalLink className="h-[17px] w-[17px]" aria-hidden />
            Открыть в афише
          </Link>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2.5 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={onRemove}
          aria-label="Удалить из плана"
          title="Удалить из плана"
          className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-ac-dark)] transition-colors hover:bg-[var(--mp-ac-soft)]"
        >
          <Trash2 className="h-[22px] w-[22px]" aria-hidden />
        </button>
        {onMove ? (
          <button
            type="button"
            onClick={onMove}
            aria-label="Перенести"
            title="Перенести"
            className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-line-strong)]"
          >
            <CalendarClock className="h-[22px] w-[22px]" aria-hidden />
          </button>
        ) : null}
        {ctaHref ? (
          <Link
            href={ctaHref}
            onClick={cta?.external ? undefined : onNavigate}
            {...(cta?.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex h-[58px] min-w-0 flex-1 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[18px] bg-[var(--mp-ac-dark)] px-3.5 text-[16.5px] font-bold text-white no-underline transition-colors hover:bg-[var(--mp-ac-dark)]/90 hover:text-white"
          >
            {cta?.label ?? (isClass ? "Записаться на пробное" : "Открыть событие")}
            {cta && price ? <span className="ml-2 text-[14.5px] font-semibold opacity-85">{price}</span> : null}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
