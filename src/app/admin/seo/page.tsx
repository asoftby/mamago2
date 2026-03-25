import Link from "next/link";
import { Globe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoDashboardKpiCard } from "@/components/admin/seo/SeoDashboardKpiCard";
import { SeoSystemStatusCard } from "@/components/admin/seo/SeoSystemStatusCard";
import { SeoDashboardSection } from "@/components/admin/seo/SeoDashboardSection";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import {
  SEO_DASHBOARD_KPIS,
  SEO_SYSTEM_STATUS,
  SEO_ATTENTION_ITEMS,
} from "@/lib/admin/seo/mocks/dashboard";
import { SEO_CONTROL_NAV } from "@/lib/admin/seoNavConfig";
import { cn } from "@/lib/utils";

const QUICK_ACCESS = SEO_CONTROL_NAV.filter((item) => item.href !== "/admin/seo").map(
  (item) => ({
    href: item.href,
    label: item.label,
    description: item.description,
  }),
);

const severityStyles = {
  high: "border-l-red-400 bg-red-50/40",
  medium: "border-l-amber-400 bg-amber-50/30",
  low: "border-l-gray-300 bg-gray-50/80",
};

export default function AdminSeoDashboardPage() {
  return (
    <div className="space-y-10 pb-8">
      <SeoPageHeader
        title="SEO Control Center"
        subtitle="Управление SEO, индексацией, редиректами, schema.org и SEO-страницами"
        leading={<Globe className="h-6 w-6 text-gray-700" aria-hidden />}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" disabled className="text-xs">
              Экспорт
            </Button>
            <Button type="button" variant="outline" size="sm" disabled className="text-xs">
              Настройки
            </Button>
          </>
        }
      />

      <SeoDashboardSection
        title="Overview"
        description="Сводные показатели по состоянию SEO-системы (данные будут из API)"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {SEO_DASHBOARD_KPIS.map((kpi) => (
            <SeoDashboardKpiCard
              key={kpi.id}
              icon={kpi.icon}
              label={kpi.label}
              value={kpi.value}
              hint={kpi.hint}
              emphasize={kpi.id === "errorsWarnings"}
            />
          ))}
        </div>
      </SeoDashboardSection>

      <SeoDashboardSection
        title="System Status"
        description="Ключевые подсистемы и их готовность"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEO_SYSTEM_STATUS.map((row) => (
            <SeoSystemStatusCard
              key={row.id}
              title={row.title}
              level={row.level}
              description={row.description}
            />
          ))}
        </div>
      </SeoDashboardSection>

      <SeoDashboardSection
        title="Attention Required"
        description="Очередь проверок и исправлений"
      >
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {SEO_ATTENTION_ITEMS.map((item) => (
            <li key={item.id}>
              <div
                className={cn(
                  "flex items-center justify-between gap-3 border-l-4 px-4 py-3.5",
                  severityStyles[item.severity],
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.detail}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-400">
          Позже: переходы в соответствующие разделы и назначение ответственных.
        </p>
      </SeoDashboardSection>

      <SeoDashboardSection
        title="Quick Access"
        description="Быстрые переходы к модулям"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {QUICK_ACCESS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
            >
              <span className="text-sm font-semibold text-gray-900 group-hover:text-gray-950">
                {item.label}
              </span>
              <span className="mt-1.5 text-xs leading-snug text-gray-500">
                {item.description}
              </span>
              <span className="mt-3 text-xs font-medium text-primary">Открыть →</span>
            </Link>
          ))}
        </div>
      </SeoDashboardSection>
    </div>
  );
}
