"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import type { RobotsIndexationSettings } from "@/lib/admin/seo/sitemapRobotsTypes";
import { AlertTriangle, ExternalLink, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface IndexationSettingsClientProps {
  robots: RobotsIndexationSettings;
  sitemapUrl: string;
  robotsTxtUrl?: string;
}

function resolveEnvironmentLabel(robots: RobotsIndexationSettings): string {
  const env =
    robots.noindexEnvironments.find((v) => Boolean(v?.trim())) ?? "unknown";
  const lower = env.toLowerCase();
  if (lower.includes("prod") || lower === "production") return "PROD";
  if (lower.includes("dev") || lower === "development") return "DEV";
  if (lower.includes("preview") || lower.includes("staging")) return "PREVIEW";
  return env.toUpperCase();
}

export function IndexationSettingsClient({
  robots,
  sitemapUrl,
  robotsTxtUrl = "/robots.txt",
}: IndexationSettingsClientProps) {
  const envLabel = resolveEnvironmentLabel(robots);
  const closed = robots.globalNoindexEnabled;
  const isProdLike = envLabel === "PROD";

  const statusTitle = closed
    ? isProdLike
      ? "PROD закрыт от поисковой индексации"
      : `${envLabel} закрыт от поисковой индексации`
    : "Индексация разрешена";

  const statusDetail = closed
    ? isProdLike
      ? "Проверьте конфигурацию окружения."
      : "Это ожидаемое состояние для среды разработки."
    : "Сайт доступен для индексации поисковыми системами.";

  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="Индексация"
        subtitle="robots.txt, sitemap.xml и доступность сайта для поисковых систем"
      />

      <Alert
        variant={closed && isProdLike ? "destructive" : "default"}
        className={cn(
          !closed && "border-emerald-200 bg-emerald-50/60 text-emerald-950",
          closed && !isProdLike && "border-amber-200 bg-amber-50/70 text-amber-950",
        )}
      >
        <Shield className="h-4 w-4" />
        <AlertTitle>{statusTitle}</AlertTitle>
        <AlertDescription>{statusDetail}</AlertDescription>
      </Alert>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <ul className="divide-y divide-gray-100">
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">robots.txt</p>
              <p className="text-xs text-gray-500">Файл правил для поисковых роботов</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href={robotsTxtUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Открыть robots.txt
              </Link>
            </Button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">sitemap.xml</p>
              <p className="text-xs text-gray-500">Карта публичных URL</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href={sitemapUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Открыть sitemap.xml
              </Link>
            </Button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Управление</p>
              <p className="text-xs text-gray-500">Управляется конфигурацией окружения</p>
            </div>
            <Badge variant="secondary">Environment configuration</Badge>
          </li>
        </ul>
      </div>

      <details className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
        <summary className="cursor-pointer font-medium text-gray-900">
          Технические детали
        </summary>
        <div className="mt-3 space-y-2 text-xs text-gray-600">
          <p>
            <span className="font-medium text-gray-800">Состояние: </span>
            {closed ? "noindex" : "index allowed"}
          </p>
          <p>
            <span className="font-medium text-gray-800">Окружение: </span>
            {robots.noindexEnvironments.join(", ") || "—"}
          </p>
          {robots.globalNoindexReason ? (
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{robots.globalNoindexReason}</span>
            </p>
          ) : null}
          <p className="text-gray-500">{robots.futureControlsNote}</p>
        </div>
      </details>
    </div>
  );
}
