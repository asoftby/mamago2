import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { SeoDashboardSection } from "@/components/admin/seo/SeoDashboardSection";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { SeoEmptyState } from "@/components/admin/seo/primitives/SeoEmptyState";
import { getSeoDashboardSummary } from "@/lib/admin/seo/data/seoAdminData";
import { formatSeoGeoContextBreadcrumb } from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";
import { SEO_SETTINGS_NAV } from "@/lib/admin/seoNavConfig";
import { buildAdminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";

const severityStyles = {
  high: "border-l-red-400 bg-red-50/40",
  medium: "border-l-amber-400 bg-amber-50/30",
  low: "border-l-gray-300 bg-gray-50/80",
};

export default async function AdminSeoOverviewPage() {
  const { context } = await resolveSeoGeoSession();
  const summary = await getSeoDashboardSummary(context);
  const breadcrumb = formatSeoGeoContextBreadcrumb(context);

  const quickLinks = [
    {
      href: buildAdminPath("/seo/pages"),
      label: "Страницы",
      description: "SEO существующих страниц по геоконтексту",
    },
    ...SEO_SETTINGS_NAV.slice(0, 2).map((item) => ({
      href: item.href,
      label: item.label,
      description: item.description,
    })),
  ];

  return (
    <div className="space-y-10 pb-8">
      <SeoPageHeader
        title="SEO"
        subtitle={`Обзор для контекста: ${breadcrumb}`}
      />

      <SeoDashboardSection
        title="Состояние"
        description="Реальные сигналы по страницам в выбранном SEO-контексте"
      >
        {summary.stats.every((s) => s.value === 0) ? (
          <SeoEmptyState
            title="Пока нет SEO-страниц в этом контексте"
            description="Смените SEO-контекст или дождитесь появления сущностей в разделе «Страницы»."
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
                      <p className="mt-0.5 text-xs text-gray-500">
                        {item.detail}
                      </p>
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
                      <p className="mt-0.5 text-xs text-gray-500">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SeoDashboardSection>

      <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-3">
        <p className="text-sm font-medium text-gray-900">Поисковые данные</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Google Search Console, Яндекс.Вебмастер и Wordstat пока не подключены.
        </p>
      </section>

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
