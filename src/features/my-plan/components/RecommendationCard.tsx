"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MediaCover } from "@/components/ui/media-cover";
import { Check, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import type { PlanItemWithActivity } from "../types/event";
import { formatActivityAddressLine } from "../lib/formatActivityAddress";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";

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

export function RecommendationCard({
  item,
  isInPlan = false,
  onAddToPlan,
  onRemoveFromPlan,
  onShowMore,
  onShowPrevious,
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
  void timeStr; // не используется в metaLine, сохранён для возможного будущего использования

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
    if (text) return text;
    if (a.priceFrom === 0) return "Бесплатно";
    if (a.priceFrom != null && !Number.isNaN(a.priceFrom)) {
      const cur = (a.currency || "BYN").trim();
      // Форматируем число с запятой: 8 → "8,00"
      const formatted = a.priceFrom.toLocaleString("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `от ${formatted} ${cur}`.trim();
    }
    return null;
  })();

  const metaLine = [agePart, datePart, priceLabel].filter(Boolean).join(" • ");
  const totalVariants = variantTotal ?? alternativesCount ?? 0;
  const currentVariant = variantPosition ?? 1;
  const showVariantControls = !isInPlan && totalVariants > 1;

  const title = item.title || item.activity?.title || "Активность";

  const titleEl = activityDetailHref ? (
    <Link
      href={activityDetailHref}
      className="line-clamp-2 text-left text-base font-semibold leading-snug tracking-tight text-neutral-900 hover:text-neutral-700"
    >
      {title}
    </Link>
  ) : (
    <span className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-neutral-900">
      {title}
    </span>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-[24px] border p-4 shadow-sm transition-all",
        "sm:gap-4 sm:p-5",
        isInPlan
          ? "border-primary bg-white"
          : "border-dashed border-[#D4D4D8] bg-[#FCFCFC] opacity-[0.74] hover:opacity-100 [border-image:none]",
      )}
    >
      {!isInPlan ? (
        <div className="inline-flex w-fit max-w-full shrink-0 items-center rounded-full border border-neutral-300 bg-transparent px-3 py-1.5">
          <Sparkles className="mr-1.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-[11px] font-medium leading-none tracking-wide text-primary/90">
            Рекомендовано <span className="font-semibold text-neutral-900">mamaGo</span>
          </p>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between">
          <div className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-3 py-1.5">
            <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            <p className="text-[11px] font-medium leading-none tracking-wide text-emerald-700">
              Добавлено
            </p>
          </div>
          <Button
            type="button"
            onClick={onRemoveFromPlan}
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 rounded-full px-2 text-neutral-500 hover:text-neutral-700"
          >
            <X className="mr-1 h-4 w-4" />
            Убрать
          </Button>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-4 transition-all duration-150 sm:flex-row sm:items-center sm:gap-5",
          isAnimating ? "opacity-80" : "opacity-100",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-row items-center gap-4">
          <div className="w-16 shrink-0 sm:w-20">
            <MediaCover
              imageUrl={item.coverImageUrl || undefined}
              alt={title}
              ratio="1/1"
              className="rounded-2xl shadow-none"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="min-w-0 space-y-1">
              {categoryLabel ? (
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  {categoryLabel}
                </p>
              ) : null}
              {titleEl}
              {metaLine ? (
                <p className="line-clamp-2 text-sm text-gray-400 sm:line-clamp-1">{metaLine}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
          {isInPlan ? (
            <>
              {participationCta ? (
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="h-9 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
            <div className="flex w-full min-w-0 justify-end sm:w-auto">
              <div
                className={cn(
                  "grid w-full max-w-full grid-cols-[auto_auto] items-start gap-x-2 sm:w-auto sm:max-w-none",
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
                      className="h-9 rounded-full border-gray-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 shrink-0" />
                        <span>Следующий вариант</span>
                        <span className="text-xs text-neutral-500">
                          {currentVariant} / {totalVariants}
                        </span>
                      </span>
                    </Button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={onAddToPlan}
                  size="sm"
                  className={cn(
                    "row-start-1 h-9 min-w-0 self-start rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-800",
                    showVariantControls ? "col-start-2" : "col-start-1",
                  )}
                >
                  <Plus className="mr-1.5 h-4 w-4 shrink-0" />
                  Добавить
                </Button>
                {noMoreAlternatives && showVariantControls ? (
                  <p className="col-start-1 row-start-2 w-full min-w-0 text-center text-xs leading-tight text-neutral-400">
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
}
