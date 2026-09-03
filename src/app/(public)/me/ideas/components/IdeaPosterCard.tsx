"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { SaveHeart } from "@/features/save/SaveHeart";
import { ArticleSaveHeart } from "@/features/save/ArticleSaveHeart";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderPriceWithIcon } from "@/components/icons/BelarusianRubleIcon";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import type { IdeaItem } from "../types";
import { C, TONES, toneForId, formatAddedDate } from "../theme";
import { IdeaCardActions } from "./IdeaCardActions";

type IdeaPosterCardProps = {
  idea: IdeaItem;
  isScheduling: boolean;
  isRemoving: boolean;
  onSchedule: () => void;
  onRemove: () => void;
};

/** Same "от X" vs "X" heuristic already duplicated in ActivityCard.tsx and page.tsx for discovery cards. */
function priceCaption(a: {
  priceFrom?: number | null;
  priceMax?: number | null;
  priceListUsesOt?: boolean | null;
}): string | null {
  if (a.priceFrom === 0) return "бесплатно";
  if (a.priceFrom == null) return null;
  const useOt =
    a.priceListUsesOt ?? !(a.priceMax != null && a.priceFrom === a.priceMax);
  return useOt ? formatPriceFrom(a.priceFrom) : formatPrice(a.priceFrom);
}

export function IdeaPosterCard({
  idea,
  isScheduling,
  isRemoving,
  onSchedule,
  onRemove,
}: IdeaPosterCardProps) {
  const activity = idea.activity;
  const href = activity.publicHref ?? "#";
  const isPastEvent = idea.ideaType === "ACTIVITY" && activity.temporalState === "PAST";
  const isArticle = idea.ideaType === "ARTICLE";
  const tone = TONES[toneForId(idea.id)];

  const ageBounds =
    idea.ideaType === "ACTIVITY"
      ? ageBoundsFromActivityFields({
          ageTags: activity.ageTags ?? [],
          ageMinMonths: activity.ageMinMonths,
          ageMaxMonths: activity.ageMaxMonths,
        })
      : null;
  const ageLabel = ageBounds?.ageFrom != null ? `${ageBounds.ageFrom}+` : null;

  const dateLabel =
    idea.ideaType === "ACTIVITY" && activity.dateStart
      ? formatRuShortDayMonthRange(activity.dateStart, activity.dateEnd ?? null)
      : idea.ideaType === "OFFER"
        ? (activity.dateLabel ?? null)
        : null;

  const priceLabel =
    idea.ideaType === "ACTIVITY"
      ? priceCaption({
          priceFrom: activity.priceFrom,
          priceMax: activity.priceMax,
          priceListUsesOt: activity.priceListUsesOt,
        })
      : idea.ideaType === "OFFER"
        ? (activity.priceText?.trim() || null)
        : null;

  const categoryLabel =
    idea.ideaType === "ROUTE"
      ? "маршрут"
      : idea.ideaType === "ARTICLE"
        ? (activity.categoryLabel ?? "статья")
        : (activity.categoryLabel ?? null);

  const metaLine = [ageLabel, dateLabel].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Link href={href} className="group block">
          <div
            className="relative overflow-hidden rounded-[18px]"
            style={{ aspectRatio: "3/4" }}
          >
            {activity.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activity.coverImageUrl}
                alt={activity.title}
                className="h-full w-full object-cover transition-transform duration-[1000ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]"
              />
            ) : (
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-2 p-5 text-center"
                style={{ background: tone }}
              >
                {metaLine && (
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: "rgba(20,18,16,.55)" }}
                  >
                    {metaLine}
                  </span>
                )}
                <div
                  className="text-[18px] leading-[1.1]"
                  style={{ fontFamily: "var(--font-display)", color: "rgba(20,18,16,.75)" }}
                >
                  {activity.title}
                </div>
              </div>
            )}

            {idea.isPlanned && (
              <span
                className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] backdrop-blur-[4px]"
                style={{ background: "rgba(20,18,16,.85)", color: C.paper }}
              >
                ● в плане
              </span>
            )}

            {priceLabel && (
              <span
                className="absolute bottom-3 right-3 inline-flex h-7 items-center rounded-full px-3 font-mono text-[11px] font-medium backdrop-blur-[4px]"
                style={{
                  background: priceLabel === "бесплатно" ? C.accent : "rgba(20,18,16,.85)",
                  color: "#fff",
                }}
              >
                {renderPriceWithIcon(normalizeUiCurrencyText(priceLabel))}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-1">
            {categoryLabel && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: C.accentDeep }}
              >
                ● {categoryLabel}
              </span>
            )}
            <h3
              className="line-clamp-2 text-[20px] leading-[1.1] tracking-[-0.015em]"
              style={{ fontFamily: "var(--font-display)", color: C.ink }}
            >
              {activity.title}
            </h3>
            <div
              className="font-mono text-[11px] uppercase tracking-[0.04em]"
              style={{ color: C.ink3 }}
            >
              {[metaLine, `добавлено ${formatAddedDate(idea.createdAt)}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </Link>

        <div className="absolute right-3 top-3 z-10">
          {idea.ideaType === "ROUTE" ? (
            <span
              aria-label="Сохранено в идеях"
              title="Сохранено в идеях"
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "rgba(250,247,241,.82)", color: C.accent }}
            >
              <Heart className="h-4 w-4 fill-current" />
            </span>
          ) : isArticle ? (
            <ArticleSaveHeart
              articleId={activity.id}
              articleTitle={activity.title}
              coverImageUrl={activity.coverImageUrl}
              source="ideas"
              initialStatus={{
                isIdea: true,
                inPlan: false,
                planDate: null,
                planStartsAt: null,
                planItemId: null,
              }}
              skipOwnFetch
              className="h-8 w-8 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px]"
              iconClassName="h-4 w-4"
            />
          ) : (
            <SaveHeart
              activityId={activity.id}
              offerId={idea.ideaType === "OFFER" ? activity.id : undefined}
              activityTitle={activity.title}
              coverImageUrl={activity.coverImageUrl}
              eventPlanDateISO={activity.dateStart ?? null}
              eventPlanDateEndISO={activity.dateEnd ?? null}
              source="ideas"
              className="h-8 w-8 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px]"
              iconClassName="h-4 w-4"
            />
          )}
        </div>
      </div>

      {isPastEvent && (
        <span
          className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ background: "rgba(20,18,16,.06)", color: C.ink2 }}
        >
          Уже прошло
        </span>
      )}

      <IdeaCardActions
        isPlanned={idea.isPlanned}
        isPast={isPastEvent}
        canSchedule={!isArticle}
        publicHref={activity.publicHref ?? null}
        onSchedule={onSchedule}
        onRemove={onRemove}
        isScheduling={isScheduling}
        isRemoving={isRemoving}
      />
    </div>
  );
}
