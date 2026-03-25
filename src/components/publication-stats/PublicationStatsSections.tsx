"use client";

import type { PublicationStatsPayload } from "@/lib/publication-stats/types";
import {
  formatNumber,
  formatPercent,
  formatSeconds,
  formatStatValue,
} from "@/lib/publication-stats/format";
import { PublicationStatsAccordionSection } from "./PublicationStatsAccordionSection";
import { PublicationStatsMetricGrid } from "./PublicationStatsMetricGrid";

function hasPartial(
  payload: PublicationStatsPayload,
  key: keyof NonNullable<PublicationStatsPayload["partial"]>
): boolean {
  if (!payload.partial) return true;
  return payload.partial[key] !== false;
}

export function PublicationStatsSections({
  payload,
}: {
  payload: PublicationStatsPayload;
}) {
  const allow = new Set(payload.allowedSections);

  return (
    <div className="flex flex-col gap-3">
      {allow.has("overview") && (
        <PublicationStatsAccordionSection title="Обзор" defaultOpen>
          {!hasPartial(payload, "overview") ? (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          ) : (
            <PublicationStatsMetricGrid
              rows={[
                {
                  label: "Просмотры всего",
                  value: formatNumber(payload.overview.viewsTotal),
                },
                {
                  label: "Уникальные просмотры",
                  value: formatNumber(payload.overview.viewsUnique),
                },
                {
                  label: "Сохранено в идеи",
                  value: formatNumber(payload.overview.saves),
                },
                {
                  label: "Добавлено в план",
                  value: formatNumber(payload.overview.planAdds),
                },
                {
                  label: "Уникальных пользователей, добавивших в план",
                  value: formatNumber(payload.overview.planUniqueUsers),
                },
                {
                  label: "Клики «Купить»",
                  value: formatNumber(payload.overview.buyClicks),
                  hint: "metric: buy_clicks",
                },
                {
                  label: "Конверсия в план",
                  value: formatPercent(payload.overview.conversionToPlan),
                },
                {
                  label: "Конверсия в покупку",
                  value: formatPercent(payload.overview.conversionToBuy),
                },
              ]}
            />
          )}
        </PublicationStatsAccordionSection>
      )}

      {allow.has("traffic") && (
        <PublicationStatsAccordionSection title="Трафик">
          {hasPartial(payload, "traffic") ? (
            <PublicationStatsMetricGrid
              rows={[
                {
                  label: "Сессии",
                  value: formatNumber(payload.traffic.sessions),
                  hint: "sessions",
                },
                {
                  label: "Повторные пользователи",
                  value: formatNumber(payload.traffic.returningUsers),
                },
                {
                  label: "Источник трафика",
                  value: formatStatValue(payload.traffic.trafficSource),
                },
                {
                  label: "Устройство",
                  value: formatStatValue(payload.traffic.device),
                },
                {
                  label: "Город",
                  value: formatStatValue(payload.traffic.city),
                },
                {
                  label: "Авторизация",
                  value: formatStatValue(payload.traffic.authState),
                },
                {
                  label: "Referrer",
                  value: formatStatValue(payload.traffic.referrer),
                },
                {
                  label: "UTM",
                  value: formatStatValue(payload.traffic.utm),
                },
              ]}
            />
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          )}
        </PublicationStatsAccordionSection>
      )}

      {allow.has("engagement") && (
        <PublicationStatsAccordionSection title="Поведение">
          {hasPartial(payload, "engagement") ? (
            <PublicationStatsMetricGrid
              rows={[
                {
                  label: "Среднее время на странице",
                  value: formatSeconds(payload.engagement.avgTimeOnPageSec),
                },
                {
                  label: "Медианное время",
                  value: formatSeconds(payload.engagement.medianTimeOnPageSec),
                },
                {
                  label: "Доскролл 25%",
                  value: formatPercent(payload.engagement.scroll25Pct),
                },
                {
                  label: "Доскролл 50%",
                  value: formatPercent(payload.engagement.scroll50Pct),
                },
                {
                  label: "Доскролл 75%",
                  value: formatPercent(payload.engagement.scroll75Pct),
                },
                {
                  label: "Доскролл 100%",
                  value: formatPercent(payload.engagement.scroll100Pct),
                },
                {
                  label: "Быстрые выходы",
                  value: formatPercent(payload.engagement.shortVisits),
                },
              ]}
            />
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          )}
        </PublicationStatsAccordionSection>
      )}

      {allow.has("actions") && (
        <PublicationStatsAccordionSection title="Действия">
          {hasPartial(payload, "actions") ? (
            <PublicationStatsMetricGrid
              rows={[
                { label: "Клик «В план»", value: formatNumber(payload.actions.clickPlan) },
                { label: "Клик сохранение", value: formatNumber(payload.actions.clickSave) },
                { label: "Клик «Купить»", value: formatNumber(payload.actions.clickBuy) },
                { label: "Клик «Поделиться»", value: formatNumber(payload.actions.clickShare) },
                { label: "Клик «Карта»", value: formatNumber(payload.actions.clickMap) },
                { label: "Клик «Маршрут»", value: formatNumber(payload.actions.clickRoute) },
                { label: "Клик «Сайт»", value: formatNumber(payload.actions.clickSite) },
                {
                  label: "Клик по похожему событию",
                  value: formatNumber(payload.actions.clickSimilarEvent),
                },
                {
                  label: "Прочие CTA",
                  value: formatNumber(payload.actions.clickOtherCta),
                },
              ]}
            />
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          )}
        </PublicationStatsAccordionSection>
      )}

      {allow.has("planning") && (
        <PublicationStatsAccordionSection title="Планирование">
          {hasPartial(payload, "planning") ? (
            <>
              <PublicationStatsMetricGrid
                rows={[
                  {
                    label: "Доступно дат у события",
                    value: formatNumber(payload.planning.datesAvailable),
                  },
                  {
                    label: "Выбор даты всего",
                    value: formatNumber(payload.planning.dateSelectionsTotal),
                  },
                  {
                    label: "Уникальный выбор даты",
                    value: formatNumber(payload.planning.dateSelectionsUnique),
                  },
                  {
                    label: "В план на сегодня",
                    value: formatNumber(payload.planning.planToday),
                  },
                  {
                    label: "В план на завтра",
                    value: formatNumber(payload.planning.planTomorrow),
                  },
                  {
                    label: "В план на другую дату",
                    value: formatNumber(payload.planning.planOtherDate),
                  },
                  {
                    label: "Удалено из плана",
                    value: formatNumber(payload.planning.planRemovals),
                  },
                ]}
              />
              {payload.planning.bySession &&
              Object.keys(payload.planning.bySession).length > 0 ? (
                <div className="mt-3 border-t border-border/20 pt-3">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    По сеансам
                  </p>
                  <PublicationStatsMetricGrid
                    rows={Object.entries(payload.planning.bySession).map(
                      ([id, n]) => ({
                        label: `Сеанс ${id}`,
                        value: formatNumber(n),
                      })
                    )}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          )}
        </PublicationStatsAccordionSection>
      )}

      {allow.has("media") && (
        <PublicationStatsAccordionSection title="Медиа">
          {hasPartial(payload, "media") ? (
            <PublicationStatsMetricGrid
              rows={[
                { label: "Просмотры reels", value: formatNumber(payload.media.reelViews) },
                {
                  label: "Досмотр reels 50%",
                  value: formatNumber(payload.media.reelWatch50),
                },
                {
                  label: "Досмотр reels 100%",
                  value: formatNumber(payload.media.reelWatch100),
                },
                {
                  label: "Просмотры трейлера",
                  value: formatNumber(payload.media.trailerViews),
                },
                {
                  label: "Досмотр трейлера 50%",
                  value: formatNumber(payload.media.trailerWatch50),
                },
                {
                  label: "Досмотр трейлера 100%",
                  value: formatNumber(payload.media.trailerWatch100),
                },
                {
                  label: "Play rate",
                  value: formatPercent(payload.media.playRate),
                  hint: "aggregate",
                },
              ]}
            />
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          )}
        </PublicationStatsAccordionSection>
      )}

      {allow.has("conversions") && (
        <PublicationStatsAccordionSection title="Конверсии">
          {hasPartial(payload, "conversions") ? (
            <PublicationStatsMetricGrid
              rows={[
                {
                  label: "Конверсия в сохранение",
                  value: formatPercent(payload.conversions.saveRate),
                },
                {
                  label: "Конверсия в план",
                  value: formatPercent(payload.conversions.planRate),
                },
                {
                  label: "Конверсия в покупку",
                  value: formatPercent(payload.conversions.buyRate),
                },
                {
                  label: "view → plan",
                  value: formatPercent(payload.conversions.viewToPlan),
                },
                {
                  label: "view → buy",
                  value: formatPercent(payload.conversions.viewToBuy),
                },
                {
                  label: "play → plan",
                  value: formatPercent(payload.conversions.playToPlan),
                },
                {
                  label: "CTR похожих",
                  value: formatPercent(payload.conversions.similarCtr),
                },
              ]}
            />
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          )}
        </PublicationStatsAccordionSection>
      )}

      {allow.has("technical") && (
        <PublicationStatsAccordionSection title="Техническое">
          {hasPartial(payload, "debug") ? (
            <PublicationStatsMetricGrid
              rows={[
                {
                  label: "publication id",
                  value: formatStatValue(payload.debug.publicationId),
                },
                {
                  label: "slug / path",
                  value: formatStatValue(payload.debug.slugOrPath),
                },
                {
                  label: "entity type",
                  value: formatStatValue(payload.debug.entityType),
                },
                {
                  label: "версия агрегации",
                  value: formatStatValue(payload.debug.aggregationVersion),
                },
                {
                  label: "сырых событий",
                  value: formatNumber(payload.debug.rawEventsCount),
                },
                {
                  label: "последняя агрегация",
                  value: formatStatValue(
                    payload.debug.lastAggregationAt
                      ? new Date(payload.debug.lastAggregationAt).toLocaleString("ru-RU")
                      : null
                  ),
                },
                {
                  label: "окно агрегации",
                  value: formatStatValue(payload.debug.aggregationWindow),
                },
                {
                  label: "data health",
                  value: formatStatValue(payload.debug.dataHealth),
                },
              ]}
            />
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Нет данных</p>
          )}
        </PublicationStatsAccordionSection>
      )}
    </div>
  );
}
