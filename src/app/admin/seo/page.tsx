import Link from "next/link";
import prisma from "@/lib/prisma";
import { getGscAnalytics } from "@/lib/admin/seo/data/gscAnalytics";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { SeoDashboardSection } from "@/components/admin/seo/SeoDashboardSection";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { SeoEmptyState } from "@/components/admin/seo/primitives/SeoEmptyState";
import { getSeoDashboardSummary } from "@/lib/admin/seo/data/seoAdminData";
import { resolveSeoMarketSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";
import {
  addDays,
  computePlanMix,
  listSeoContentPlanItems,
  startOfWeekMonday,
} from "@/lib/admin/seo/plan/seoContentPlan.service";
import { computeInternalSearchTrends } from "@/lib/admin/seo/topics/internalTrends";
import { buildAdminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";

const severityStyles = {
  high: "border-l-red-400 bg-red-50/40",
  medium: "border-l-amber-400 bg-amber-50/30",
  low: "border-l-gray-300 bg-gray-50/80",
};

export default async function AdminSeoOverviewPage() {
  const session = await resolveSeoMarketSession();
  const summary = await getSeoDashboardSummary(session.filter);
  const gsc = await getGscAnalytics(prisma);

  const weekFrom = startOfWeekMonday(new Date());
  const weekTo = addDays(weekFrom, 7);
  const [planItems, trends] = await Promise.all([
    listSeoContentPlanItems({
      filter: session.filter,
      from: weekFrom,
      to: weekTo,
    }),
    computeInternalSearchTrends({
      filter: session.filter,
      geographyLabel: session.presentation.marketLabel,
    }),
  ]);
  const mix = computePlanMix(planItems);
  const statusCounts = {
    planned: planItems.filter((i) => i.status === "PLANNED").length,
    inProgress: planItems.filter((i) => i.status === "IN_PROGRESS").length,
    published: planItems.filter((i) => i.status === "PUBLISHED").length,
  };

  const quickLinks = [
    {
      href: buildAdminPath("/seo/pages"),
      label: "Страницы",
      description: "SEO существующих страниц по SEO-рынку",
    },
    {
      href: buildAdminPath("/seo/plan"),
      label: "План контента",
      description: "Что запланировано к публикации",
    },
    {
      href: buildAdminPath("/seo/topics"),
      label: "Темы и тренды",
      description: "Внутренний спрос mamaGo",
    },
  ];

  return (
    <div className="space-y-10 pb-8">
      <SeoPageHeader
        title="SEO"
        subtitle={`Обзор · ${session.presentation.marketLabel}`}
      />

      <SeoDashboardSection
        title="Состояние"
        description="Реальные сигналы по страницам в выбранном SEO-рынке"
      >
        {summary.stats.every((s) => s.value === 0) ? (
          <SeoEmptyState
            title="Пока нет SEO-страниц в этом рынке"
            description="Смените SEO-рынок или дождитесь появления сущностей в разделе «Страницы»."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {summary.stats.map((stat) => (
              <Link
                key={stat.id}
                href={stat.href ?? buildAdminPath("/seo/pages")}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-gray-500">{stat.hint}</p>
              </Link>
            ))}
          </div>
        )}
      </SeoDashboardSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">План контента</h2>
          <p className="mt-2 text-sm text-gray-600">
            На этой неделе: {mix.plannedTotal}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Запланировано: {statusCounts.planned} · В работе:{" "}
            {statusCounts.inProgress} · Опубликовано: {statusCounts.published}
          </p>
          <Link
            href={buildAdminPath("/seo/plan")}
            className="mt-3 inline-flex text-xs font-medium text-primary"
          >
            Открыть план →
          </Link>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Темы</h2>
          <p className="mt-2 text-sm text-gray-600">
            Растущих запросов: {trends.risingCount}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Высокий потенциал: {trends.highPotentialCount}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">
            Источник: поиск внутри mamaGo
          </p>
          <Link
            href={buildAdminPath("/seo/topics")}
            className="mt-3 inline-flex text-xs font-medium text-primary"
          >
            Посмотреть темы →
          </Link>
        </section>
      </div>

      <SeoDashboardSection
        title="Требует внимания"
        description="Очередь по локальным диагностикам"
      >
        {summary.attentionItems.length === 0 ? (
          <SeoEmptyState
            icon={<AlertTriangle className="h-6 w-6 text-gray-400" />}
            title="Сейчас нет срочных проблем"
            description="Когда появятся ошибки диагностики, незаполненные SEO-поля или глобальный noindex — они отобразятся здесь."
          />
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {summary.attentionItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between gap-3 border-l-4 px-4 py-3.5 transition-colors hover:bg-gray-50",
                      severityStyles[item.severity],
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{item.detail}</p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-gray-300"
                      aria-hidden
                    />
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 border-l-4 px-4 py-3.5",
                      severityStyles[item.severity],
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{item.detail}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SeoDashboardSection>

      <SeoDashboardSection title="Google Search Console" description="Поисковый трафик всей property · выбранный SEO-рынок не фильтрует эти данные">
        <p className="text-sm text-gray-600">{gsc?.property ?? "Интеграция выключена или property не настроена"}</p>
        {gsc?.metrics ? <>
          <p className="text-xs text-gray-500">7 дней по {gsc.dataThrough} (Pacific Time). Обновлено: {gsc.collectedAt}</p>
          {gsc.stale && <p className="text-sm text-amber-700">Данные устарели. Проверьте состояние сборщика.</p>}
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Клики", gsc.metrics.clicks, gsc.metrics.clicksChangePercent, "% к предыдущим 7 дням"],
              ["Показы", gsc.metrics.impressions, gsc.metrics.impressionsChangePercent, "% к предыдущим 7 дням"],
              ["CTR, %", gsc.metrics.ctr === null ? null : Math.round(gsc.metrics.ctr * 10000) / 100, gsc.metrics.ctrDeltaPp, "п.п."],
              ["Позиция", gsc.metrics.position === null ? null : Math.round(gsc.metrics.position * 10) / 10, gsc.metrics.positionDelta, "к предыдущим 7 дням"],
            ].map(([label, value, delta, unit]) => <div key={String(label)} className="rounded-xl border border-gray-200 bg-white p-4">
              <dt className="text-sm text-gray-500">{label}</dt><dd className="text-2xl font-semibold tabular-nums">{value ?? "—"}</dd>
              <dd className="text-xs text-gray-500">{delta === null ? "Нет сравнения" : `${delta} ${unit}`}</dd>
            </div>)}
          </dl>
          <p className="text-xs text-gray-500">Изменения кликов среди страниц, присутствующих в обеих top-50 выборках:</p>
          <ul className="text-sm text-gray-600">{[...gsc.metrics.rising, ...gsc.metrics.falling].map((row) =>
            <li key={row.page} className="break-all">{row.page}: {row.deltaClicks > 0 ? "+" : ""}{row.deltaClicks}</li>)}</ul>
        </> : <p className="text-sm text-gray-500">Данные ещё не получены. Нулевые значения не подставляются.</p>}
      </SeoDashboardSection>

      <SeoDashboardSection title="Быстрый доступ" description="Рабочие разделы">
        <div className="grid gap-3 sm:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
            >
              <span className="text-sm font-semibold text-gray-900">
                {item.label}
              </span>
              <span className="mt-1.5 text-xs leading-snug text-gray-500">
                {item.description}
              </span>
              <span className="mt-3 text-xs font-medium text-primary">
                Открыть →
              </span>
            </Link>
          ))}
        </div>
      </SeoDashboardSection>
    </div>
  );
}
