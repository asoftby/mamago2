"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MediaCover } from "@/components/ui/media-cover";
import { Check, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import { formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import type { PlanItemWithActivity } from "../types/event";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { postProductTelemetryEvent } from "@/lib/analytics/client";

interface RecommendationCardProps {
  item: PlanItemWithActivity;
  isInPlan?: boolean;
  isRecommendation?: boolean;
  onAddToPlan?: () => void;
  onRemoveFromPlan?: () => void;
  onShowMore?: () => void;
  onShowPrevious?: () => void;
  /** Сколько подходящих рекомендаций в слоте; при 1 — «Ещё варианты» неактивна */
  alternativesCount?: number;
  variantPosition?: number;
  variantTotal?: number;
}

type RecommendationActivityTrace = {
  recommendationRunId?: string | null;
  recommendationExposureId?: string | null;
  recommendationPosition?: number | null;
  recommendationAlgorithmVersion?: string | null;
  eventCategory?: { id?: string; nameRu: string } | null;
};

export function RecommendationCard({
  item,
  isInPlan = false,
  onAddToPlan,
  onRemoveFromPlan,
  onShowMore,
  alternativesCount,
  variantPosition,
  variantTotal,
}: RecommendationCardProps) {
  const [isAnimating, setIsAnimating] = useState(() => false);
  const prevItemIdRef = useRef(item.id);

  useEffect(() => {
    if (prevItemIdRef.current !== item.id) {
      prevItemIdRef.current = item.id;
      const t = window.setTimeout(() => {
        setIsAnimating(true);
        window.setTimeout(() => setIsAnimating(false), 150);
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [item.id]);

  const noMoreAlternatives =
    alternativesCount !== undefined && alternativesCount <= 1;
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const activityDetailHref = item.activity?.id
    ? publicActivityPath(item.activity.id, city, item.activity.slug)
    : null;

  const participationCta = item.activity
    ? resolveActivityParticipationCta(item.activity, city)
    : null;

  const timeStr = item.startsAt
    ? new Date(item.startsAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  void timeStr;

  const agePart = item.activity?.ageLabel ?? null;
  const categoryLabel = item.activity?.eventCategory?.nameRu?.trim() || null;

  const datePart = (() => {
    const src = item.startsAt ?? (item.date ? new Date(item.date + "T12:00:00") : null);
    if (!src) return null;
    const d = src instanceof Date ? src : new Date(src);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  })();

  const priceLabel = (() => {
    const a = item.activity;
    if (!a) return null;
    const text = a.priceText?.trim();
    if (text) return normalizeUiCurrencyText(text);
    if (a.priceFrom === 0) return "Бесплатно";
    if (a.priceFrom != null && !Number.isNaN(a.priceFrom)) {
      return formatPriceFrom(a.priceFrom);
    }
    return null;
  })();

  const metaLine = [agePart, datePart, priceLabel].filter(Boolean).join(" • ");
  const totalVariants = variantTotal ?? alternativesCount ?? 0;
  const currentVariant = variantPosition ?? 1;
  const showVariantControls = !isInPlan && totalVariants > 1;

  const title = item.title || item.activity?.title || "Активность";
  const isRoute = item.routeId || item.planRouteSlug;
  const recommendationTrace = !isInPlan
    ? (item.activity as (typeof item.activity & RecommendationActivityTrace) | null)
    : null;
  const recommendationExposureId = recommendationTrace?.recommendationExposureId?.trim() || null;
  const recommendationRunId = recommendationTrace?.recommendationRunId?.trim() || null;
  const recommendationPosition = recommendationTrace?.recommendationPosition ?? undefined;
  const categoryId = recommendationTrace?.eventCategory?.id;

  const recommendationMeta = recommendationExposureId
    ? {
        source: "recommendation" as const,
        section: "my_plan" as const,
        recommendationSurface: "my_plan" as const,
        recommendationExposureId,
        ...(recommendationRunId ? { recommendationRunId } : {}),
        ...(recommendationPosition ? { position: recommendationPosition } : {}),
        ...(categoryId ? { categoryIds: [categoryId] } : {}),
        dateFrom: item.date,
        dateTo: item.date,
      }
    : null;

  const trackRecommendationDetailOpen = () => {
    if (!recommendationMeta || !item.activity?.id) return;
    void postProductTelemetryEvent({
      eventType: "DETAIL_OPEN",
      entityType: "EVENT",
      entityId: item.activity.id,
      vertical: "CITY",
      citySlug: city,
      meta: recommendationMeta,
    });
  };

  const titleEl = activityDetailHref ? (
    <Link
      href={activityDetailHref}
      onClick={trackRecommendationDetailOpen}
      className="line-clamp-2 text-left text-[15.5px] font-bold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)] hover:text-[var(--mp-ac-dark)]"
    >
      {title}
    </Link>
  ) : (
    <span className="line-clamp-2 text-[15.5px] font-bold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)]">
      {title}
    </span>
  );

  const card = (
    <div
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-[18px] border bg-[var(--mp-card)] p-3 transition-colors",
        isInPlan
          ? "border-[var(--mp-tx)]"
          : "border-[var(--mp-line)] hover:border-[var(--mp-line-strong)]",
      )}
    >
      {!isInPlan ? (
        <div className="inline-flex w-fit max-w-full shrink-0 items-center rounded-full bg-[var(--mp-ac-soft)] px-3 py-1.5">
          <Sparkles className="mr-1.5 h-3.5 w-3.5 shrink-0 text-[var(--mp-ac)]" />
          <p className="text-[11px] font-semibold leading-none tracking-wide text-[var(--mp-ac-dark)]">
            Рекомендовано <span className="font-bold text-[var(--mp-tx)]">mamaGo</span>
          </p>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between">
          <div className="inline-flex shrink-0 items-center rounded-full bg-[#E6F0EA] px-3 py-1.5">
            <Check className="mr-1.5 h-3.5 w-3.5 text-[#2B6448]" />
            <p className="text-[11px] font-medium leading-none tracking-wide text-[#2B6448]">
              Добавлено
            </p>
          </div>
          <Button
            type="button"
            onClick={onRemoveFromPlan}
            variant="ghost"
            size="sm"
            className="h-11 shrink-0 rounded-full px-3 text-[var(--mp-tx2)] hover:text-[var(--mp-tx)]"
          >
            <X className="mr-1 h-4 w-4" />
            Убрать
          </Button>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-3 transition-all duration-150",
          isAnimating ? "opacity-80" : "opacity-100",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-row items-start gap-3">
          <div className="w-[88px] shrink-0">
            <MediaCover
              imageUrl={item.coverImageUrl || undefined}
              alt={title}
              ratio="1/1"
              className="rounded-xl shadow-none"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="min-w-0 space-y-1">
              {isRoute ? (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mp-tx2)]">
                  Маршрут
                </p>
              ) : categoryLabel ? (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mp-tx2)]">
                  {categoryLabel}
                </p>
              ) : null}
              {titleEl}
              {metaLine ? (
                <p className="line-clamp-2 text-[13px] leading-[1.4] text-[var(--mp-tx2)]">{metaLine}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2">
          {isInPlan ? (
            <>
              {participationCta ? (
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="h-11 w-full shrink-0 rounded-xl bg-[var(--mp-ac)] px-4 text-[14.5px] font-bold text-white hover:bg-[var(--mp-ac-dark)]"
                >
                  {participationCta.external ? (
                    <a
                      href={participationCta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {participationCta.label}
                    </a>
                  ) : (
                    <Link href={participationCta.href}>{participationCta.label}</Link>
                  )}
                </Button>
              ) : null}
            </>
          ) : (
            <div className="flex w-full min-w-0 justify-end">
              <div
                className={cn(
                  "grid w-full max-w-full grid-cols-[auto_1fr] items-start gap-x-2",
                  noMoreAlternatives ? "grid-rows-[auto_auto] gap-y-1" : "grid-rows-[auto]",
                )}
              >
                {showVariantControls ? (
                  <div className="col-start-1 row-start-1 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onShowMore}
                      disabled={!onShowMore || noMoreAlternatives}
                      className="h-11 rounded-xl border-[var(--mp-line-strong)] px-3 text-sm font-bold text-[var(--mp-tx)] hover:bg-[var(--mp-soft)]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 shrink-0" />
                        <span>Следующий вариант</span>
                        <span className="text-xs text-[var(--mp-tx2)]">
                          {currentVariant} / {totalVariants}
                        </span>
                      </span>
                    </Button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="default"
                  onClick={onAddToPlan}
                  size="sm"
                  className={cn(
                    "row-start-1 h-11 w-full min-w-0 self-start rounded-xl border-[1.5px] border-[var(--mp-line-strong)] bg-transparent px-4 text-[14.5px] font-bold text-[var(--mp-tx)] shadow-none hover:border-[var(--mp-tx)] hover:bg-transparent",
                    showVariantControls ? "col-start-2" : "col-start-1",
                  )}
                >
                  <Plus className="mr-1.5 h-4 w-4 shrink-0" />
                  Добавить в план
                </Button>
                {noMoreAlternatives && showVariantControls ? (
                  <p className="col-start-1 row-start-2 w-full min-w-0 text-center text-xs leading-tight text-[var(--mp-tx2)]">
                    только этот вариант
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (recommendationMeta && item.activity?.id) {
    return (
      <AnalyticsCardViewTracker
        entityType="EVENT"
        entityId={item.activity.id}
        vertical="CITY"
        citySlug={city}
        meta={recommendationMeta}
      >
        {card}
      </AnalyticsCardViewTracker>
    );
  }

  return card;
}
