"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type {
  RobotsIndexationSettings,
  SitemapRegenerationStatus,
  SitemapSectionRow,
  SitemapStatusSnapshot,
} from "@/lib/admin/seo/sitemapRobotsTypes";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  FileSearch,
  Globe2,
  RefreshCw,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { TableContainer } from "@/components/ui/table";

const REGEN_LABEL: Record<SitemapRegenerationStatus, string> = {
  idle: "Готово",
  running: "Генерация…",
  queued: "В очереди",
  failed: "Ошибка",
};

const REGEN_BADGE: Record<
  SitemapRegenerationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  idle: "secondary",
  running: "default",
  queued: "outline",
  failed: "destructive",
};

const ROBOTS_STATUS_LABEL: Record<
  RobotsIndexationSettings["robotsStatus"],
  string
> = {
  ok: "Актуален",
  stale: "Устарел",
  missing: "Не найден",
};

interface SitemapRobotsCenterClientProps {
  initialStatus: SitemapStatusSnapshot;
  initialSections: SitemapSectionRow[];
  initialRobots: RobotsIndexationSettings;
}

function formatDateTime(iso: string) {
  try {
    return format(new Date(iso), "d MMMM yyyy, HH:mm", { locale: ru });
  } catch {
    return iso;
  }
}

export function SitemapRobotsCenterClient({
  initialStatus,
  initialSections,
  initialRobots,
}: SitemapRobotsCenterClientProps) {
  return (
    <div className="space-y-10">
      <SeoPageHeader
        title="Sitemap & Robots"
        subtitle="Управление sitemap, robots directives и индексируемостью системных разделов"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              className="gap-2"
              disabled
              title="Подключение к генератору sitemap — в следующей итерации"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Regenerate sitemap
            </Button>
            <Button type="button" variant="outline" className="gap-2" asChild>
              <Link
                href={initialStatus.sitemapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                View sitemap
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled
              title="Валидация XML и отчёты — в следующей итерации"
            >
              <FileSearch className="h-4 w-4" aria-hidden />
              Validate sitemap
            </Button>
          </div>
        }
      />

      {/* A. Sitemap status */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-slate-600" aria-hidden />
          <h2 className="text-base font-semibold text-gray-900">
            Sitemap status
          </h2>
        </div>
        <p className="max-w-3xl text-sm text-gray-600">
          Текущее состояние индекса URL: где лежит sitemap, когда собирался и
          какие секции вошли в выгрузку.
        </p>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Сводка</CardTitle>
                <CardDescription>
                  Данные для мониторинга SEO и инфраструктуры
                </CardDescription>
              </div>
              <Badge variant={REGEN_BADGE[initialStatus.regenerationStatus]}>
                {REGEN_LABEL[initialStatus.regenerationStatus]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sitemap URL
                </p>
                <p className="mt-1 break-all font-mono text-sm text-foreground">
                  {initialStatus.sitemapUrl}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Last generated
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTime(initialStatus.lastGeneratedAt)}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Indexed pages (в sitemap)
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {initialStatus.indexedPagesCount.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Included sections
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {initialStatus.includedSectionsSummary.map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Regeneration status</span>
              <span className="font-medium text-foreground">
                {REGEN_LABEL[initialStatus.regenerationStatus]}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* B. Sitemap sections */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Sitemap sections
        </h2>
        <p className="max-w-3xl text-sm text-gray-600">
          Секции контента в выгрузке: можно сопоставить с бизнес-логикой и
          приоритетами обхода.
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <TableContainer
            minWidthClassName="min-w-[560px]"
            scrollLabel="Таблица секций sitemap, прокручивается по горизонтали"
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50/90">
                  <th className="px-4 py-3 font-semibold text-gray-800">
                    Section
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-800">
                    Included in sitemap
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-800">
                    Pages count
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-800">
                    Last updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {initialSections.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.section}
                    </td>
                    <td className="px-4 py-3">
                      {row.includedInSitemap ? (
                        <Badge variant="default" className="font-normal">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          No
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-800">
                      {row.pagesCount.toLocaleString("ru-RU")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(row.lastUpdatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        </div>
      </section>

      {/* C. Robots / indexation */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-600" aria-hidden />
          <h2 className="text-base font-semibold text-gray-900">
            Robots / indexation settings
          </h2>
        </div>
        <p className="max-w-3xl text-sm text-gray-600">
          Системные правила индексации: разрешение на индекс, среды с{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            noindex
          </code>{" "}
          и состояние{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            robots.txt
          </code>
          .
        </p>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Индексация</CardTitle>
                <CardDescription>
                  Глобальное управление доступностью сайта для поисковых систем.
                </CardDescription>
              </div>
              <Badge variant={initialRobots.globalNoindexEnabled ? "destructive" : "secondary"}>
                {initialRobots.globalNoindexEnabled
                  ? "Noindex включен"
                  : "Индексация разрешена"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  Запретить индексацию всего сервиса
                </p>
                <p className="text-xs text-gray-500">
                  На текущем этапе настройка управляется через env. Полноценное управление из
                  админки будет добавлено после появления глобальной SEO settings модели.
                </p>
              </div>
              <Switch
                checked={initialRobots.globalNoindexEnabled}
                disabled
                aria-label="Global noindex status"
              />
            </div>

            {initialRobots.globalNoindexEnabled ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Сайт закрыт от индексации</AlertTitle>
                <AlertDescription>
                  Индексация открывается только через `SITE_INDEXING_ENABLED=true`. Перед запуском
                  убедитесь, что `SITE_NOINDEX_FORCE=false`; `SITE_NOINDEX_DEFAULT=false` сам по себе
                  индексацию не открывает.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Индексация разрешена</AlertTitle>
                <AlertDescription>
                  Глобальный запрет индексации не активен. Публичные страницы могут индексироваться
                  по обычным правилам SEO.
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4">
              <p className="text-sm font-medium text-slate-900">Источник состояния</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {initialRobots.globalNoindexReason}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Системные настройки</CardTitle>
            <CardDescription>
              Значения приходят из конфигурации окружения и SEO-политики
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className={cn(
                  "rounded-lg border px-4 py-3",
                  initialRobots.allowIndexing
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-amber-200 bg-amber-50/50",
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Allow indexing
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {initialRobots.allowIndexing
                    ? "Разрешена (production)"
                    : "Запрещена"}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/15 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Robots status
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {ROBOTS_STATUS_LABEL[initialRobots.robotsStatus]}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Controls managed by</span>
              <Badge variant="outline" className="font-mono text-xs">
                {initialRobots.controlsManagedBy}
              </Badge>
            </div>
            <div
              className={cn(
                "rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4",
                "dark:border-slate-600 dark:bg-slate-950/30",
              )}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Environment used for noindex decision
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {initialRobots.globalNoindexReason}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
