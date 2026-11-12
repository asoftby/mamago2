"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import { planEntryDisplay } from "../../lib/planEntryDisplay";
import { formatPlanCardPrice } from "../../lib/planPagePresentation";
import { resolveActivityAddress } from "../../lib/formatActivityAddress";
import { formatPlanAgeLabel } from "../../lib/formatPlanAgeLabel";
import type { PlanItemWithActivity } from "../../types/event";
import { CatalogPreviewScreen, PREVIEW_PRIMARY, PreviewFooterButtons, type PreviewRow } from "../CatalogPreviewScreen";

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
 * Вёрстка — общий CatalogPreviewScreen; здесь только данные события.
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

  const rows: PreviewRow[] = [{ icon: "date", primary: `${formatEventDate(item.date)}${time ? ` · ${time}` : ""}`, secondary: activity?.eventCategory?.nameRu ?? undefined }];
  if (placeTitle || street) rows.push({ icon: "place", primary: placeTitle ?? street, secondary: placeTitle && street ? street : undefined });

  return (
    <CatalogPreviewScreen
      back="План"
      onBack={onBack}
      badge={isClass ? "Занятие" : "Из афиши"}
      tone={isClass ? "class" : "event"}
      fromScenario={Boolean(item.scenarioId)}
      coverUrl={poster}
      title={title}
      ageLabel={formatPlanAgeLabel(activity?.ageLabel)}
      rows={rows}
      linkSlot={
        detailHref ? (
          <Link
            href={detailHref}
            onClick={onNavigate}
            className="mx-auto mt-3.5 flex min-h-11 w-fit items-center gap-2 rounded-xl px-2.5 text-[15.5px] font-bold text-[var(--mp-ac-dark)] no-underline transition-colors hover:text-[var(--mp-ac)]"
          >
            <ExternalLink className="h-[17px] w-[17px]" aria-hidden />
            Открыть в афише
          </Link>
        ) : null
      }
      footer={
        <>
          <PreviewFooterButtons onRemove={onRemove} onMove={onMove} />
          {ctaHref ? (
            <Link
              href={ctaHref}
              onClick={cta?.external ? undefined : onNavigate}
              {...(cta?.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={PREVIEW_PRIMARY}
            >
              {cta?.label ?? (isClass ? "Записаться на пробное" : "Открыть событие")}
              {cta && price ? <span className="ml-2 text-[14.5px] font-semibold opacity-85">{price}</span> : null}
            </Link>
          ) : null}
        </>
      }
    />
  );
}
