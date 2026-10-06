"use client";

import { FileText, Lightbulb, CalendarDays } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { SeoEmptyState } from "@/components/admin/seo/primitives/SeoEmptyState";
import {
  DEFAULT_GEO_CONTENT_MIX,
  allocateGeoMixTargets,
  type GeoContentMix,
} from "@/lib/admin/seo/geo";

interface SeoContentFoundationClientProps {
  breadcrumb: string;
  mix?: GeoContentMix;
  /** When content-plan records exist, pass real counts. Until then keep null. */
  planCounts?: {
    city: number;
    region: number;
    national: number;
    plannedTotal: number;
  } | null;
}

export function SeoContentFoundationClient({
  breadcrumb,
  mix = DEFAULT_GEO_CONTENT_MIX,
  planCounts = null,
}: SeoContentFoundationClientProps) {
  const targets = allocateGeoMixTargets(planCounts?.plannedTotal ?? 10, mix);

  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="Контент"
        subtitle={`SEO Content OS для контекста: ${breadcrumb}`}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900">Баланс контента</h2>
        <p className="mt-1 text-xs text-gray-500">
          Целевая пропорция будущего медиаплана (настраиваемая, не жёсткий
          алгоритм). NATIONAL = GeoScope.COUNTRY.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MixShareCard label="Город" share={mix.cityShare} scope="CITY" />
          <MixShareCard label="Регион" share={mix.regionShare} scope="REGION" />
          <MixShareCard
            label="Национальный"
            share={mix.nationalShare}
            scope="COUNTRY"
          />
        </div>

        {planCounts ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MixActualCard
              label="Городские темы"
              actual={planCounts.city}
              target={targets.city}
            />
            <MixActualCard
              label="Региональные темы"
              actual={planCounts.region}
              target={targets.region}
            />
            <MixActualCard
              label="Национальные темы"
              actual={planCounts.national}
              target={targets.national}
            />
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-500">
            Фактический план недели появится после сохранения контент-плана.
            Сейчас показаны только целевые доли.
          </p>
        )}
      </section>

      <Tabs defaultValue="plan" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="plan">План</TabsTrigger>
          <TabsTrigger value="topics">Темы</TabsTrigger>
          <TabsTrigger value="published">Опубликовано</TabsTrigger>
        </TabsList>

        <TabsContent value="plan">
          <SeoEmptyState
            icon={<CalendarDays className="h-6 w-6 text-gray-400" />}
            title="Контент-план ещё не создан"
            description="Здесь будет недельный медиаплан с целевой и фактической пропорцией CITY / REGION / NATIONAL для текущего SEO-контекста. Сохранение плана в БД ещё не подключено."
          />
        </TabsContent>

        <TabsContent value="topics">
          <SeoEmptyState
            icon={<Lightbulb className="h-6 w-6 text-gray-400" />}
            title="Тем пока нет"
            description="Будущие сущности: идея, тема, SEO opportunity и рекомендация обновить материал — всегда с geo context."
          />
        </TabsContent>

        <TabsContent value="published">
          <SeoEmptyState
            icon={<FileText className="h-6 w-6 text-gray-400" />}
            title="Опубликованные SEO-материалы"
            description="Список опубликованных статей текущего SEO-контекста появится после связывания контент-плана со статьями (geoScope / cityId / regionId)."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MixShareCard({
  label,
  share,
  scope,
}: {
  label: string;
  share: number;
  scope: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-3">
      <p className="text-xs font-medium text-gray-500">
        {label}{" "}
        <span className="font-mono text-[10px] uppercase text-gray-400">
          {scope}
        </span>
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
        {share}%
      </p>
    </div>
  );
}

function MixActualCard({
  label,
  actual,
  target,
}: {
  label: string;
  actual: number;
  target: number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
        {actual} / {target}
      </p>
    </div>
  );
}
