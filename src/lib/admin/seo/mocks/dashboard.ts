/**
 * Моки дашборда SEO Control Center.
 * Замена: GET /api/admin/seo/dashboard → `SeoDashboardSummary`.
 */
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Link2,
  Boxes,
  Unlink,
  Map,
  AlertTriangle,
} from "lucide-react";
import type {
  SeoDashboardAttentionItem,
  SeoDashboardKpi,
  SeoDashboardSummary,
  SeoDashboardSystemStatus,
  SeoKpiId,
} from "../domain/types";

const KPI_ICONS: Record<SeoKpiId, LucideIcon> = {
  seoPages: FileText,
  redirects: Link2,
  schemaTemplates: Boxes,
  unmatchedUrls: Unlink,
  sitemapUrls: Map,
  errorsWarnings: AlertTriangle,
};

const MOCK_KPIS: SeoDashboardKpi[] = [
  {
    id: "seoPages",
    label: "SEO Pages",
    value: "1 240",
    hint: "Страницы с настроенными meta",
  },
  {
    id: "redirects",
    label: "Redirects",
    value: "86",
    hint: "Активные правила",
  },
  {
    id: "schemaTemplates",
    label: "Schema Templates",
    value: "12",
    hint: "Шаблоны JSON-LD",
  },
  {
    id: "unmatchedUrls",
    label: "Unmatched URLs",
    value: "23",
    hint: "Без сопоставления с маршрутом",
  },
  {
    id: "sitemapUrls",
    label: "Sitemap URLs",
    value: "8 920",
    hint: "В последней выгрузке",
  },
  {
    id: "errorsWarnings",
    label: "Errors / Warnings",
    value: "3",
    hint: "Требуют проверки",
  },
];

const MOCK_SYSTEM: SeoDashboardSystemStatus[] = [
  {
    id: "indexation",
    title: "Indexation",
    level: "ok",
    description: "Последняя проверка: конфликтов с noindex не найдено",
  },
  {
    id: "redirects",
    title: "Redirect system",
    level: "ok",
    description: "Правила применяются, циклов не обнаружено",
  },
  {
    id: "schema",
    title: "Schema coverage",
    level: "warning",
    description: "Часть шаблонов без обязательных полей",
  },
  {
    id: "sitemap",
    title: "Sitemap status",
    level: "empty",
    description: "Генерация ещё не настроена для всех секций",
  },
];

const MOCK_ATTENTION: SeoDashboardAttentionItem[] = [
  {
    id: "a1",
    title: "Unmatched URLs",
    detail: "23 URL без маппинга на контент",
    severity: "medium",
  },
  {
    id: "a2",
    title: "Schema warnings",
    detail: "Event: отсутствует offers на 4 страницах",
    severity: "low",
  },
  {
    id: "a3",
    title: "Pages without metadata",
    detail: "Список страниц без title или description",
    severity: "high",
  },
  {
    id: "a4",
    title: "Missing canonical rules",
    detail: "Дубли без каноникала в разделе «Куда»",
    severity: "medium",
  },
];

export function createSeoDashboardSummary(): SeoDashboardSummary {
  return {
    kpis: MOCK_KPIS,
    systemStatuses: MOCK_SYSTEM,
    attentionItems: MOCK_ATTENTION,
  };
}

/** Снимок для страницы (без иконок — чистые данные) */
export const MOCK_SEO_DASHBOARD_SUMMARY: SeoDashboardSummary =
  createSeoDashboardSummary();

/** KPI с иконками для UI — до появления `icon` из API */
export type SeoDashboardKpiView = SeoDashboardKpi & { icon: LucideIcon };

export function getSeoDashboardKpisForUi(): SeoDashboardKpiView[] {
  return MOCK_KPIS.map((k) => ({ ...k, icon: KPI_ICONS[k.id] }));
}

export const SEO_SYSTEM_STATUS: SeoDashboardSystemStatus[] = MOCK_SYSTEM;
export const SEO_ATTENTION_ITEMS: SeoDashboardAttentionItem[] = MOCK_ATTENTION;

/** @deprecated Используйте `getSeoDashboardKpisForUi` или `MOCK_SEO_DASHBOARD_SUMMARY.kpis` */
export const SEO_DASHBOARD_KPIS: SeoDashboardKpiView[] = getSeoDashboardKpisForUi();
